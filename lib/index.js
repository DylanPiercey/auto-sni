var tls = require('tls')
var Server = require('node-static').Server
var toReg = require('path-to-regexp')
var load = require('./load')
var CONSTANTS = require('./constants')
var STATIC_PATH = CONSTANTS.STATIC_PATH
var noop = function () {}

// Export http and https so that they can be overwriten.
createServer.http = require('http')
createServer.https = require('https')

// Expose lib to the world.
module.exports = createServer

/**
 * Like nodes https.createServer but will automatically generate certificates from letsencrypt
 * falling back to self signed.
 *
 * @param {Object} opts
 * @param {Function} handler
 * @return {Server}
 */
function createServer (opts, handler) {
  opts = opts || {}
  var ports = opts.ports = opts.ports || {}
  var http = createServer.http
  var https = createServer.https

  if (!('email' in opts)) throw new TypeError('AutoSNI: Email is required.')
  if (!('agreeTos' in opts)) throw new TypeError('AutoSNI: Must agree to LE TOS.')
  if (!('ip' in opts)) opts.ip = '0.0.0.0'
  if (!('http' in ports)) ports.http = 80
  if (!('https' in ports)) ports.https = 443
  if (!('forceSSL' in opts)) opts.forceSSL = true
  if (typeof handler !== 'function') handler = noop

  // Convert allowed domains to regexps.
  if (Array.isArray(opts.domains)) {
    opts.domains = opts.domains.map(function (domain) {
      return toReg(domain, [], { strict: true })
    })
  }

  // Start up a file server for webroot challenges.
  var fileServer = new Server(STATIC_PATH)

  // Start a http -> https server.
  var httpServer = http
    .createServer()
    .on('request', handleChallenge)
    .listen(ports.http, opts.ip)

  // Start the secure server.
  var httpsServer = https
    .createServer({ SNICallback: SNICallback })
    .on('request', handleChallenge)
    .listen(ports.https, opts.ip)


  // Close either server if the other has an error
  httpsServer.on('error', httpServer.close.bind(httpServer))
  httpServer.on('error', httpsServer.close.bind(httpServer))

  var addListener = function (event, handler) {
    // Listening and close are two events where we want
    // to make sure that both servers are done
    if (event === 'listening' || event === 'close') {
      var bufferOne = function () {
        next = done
      }
      var done = function () {
        // After being disconnected its possible that
        // users want to re-use this server instance/
        // so we reset it again to next
        next = bufferOne
        handler.apply(null, arguments)
      }
      var next = bufferOne
      httpsServer.on(event, next)
      httpServer.on(event, next)
      return
    }
    both('addListener', opts.forceSSL)
  }

  var CombinedServer = Object.create(createServer.https.Server, {
    addListener: { value: addListener },
    on: { value: addListener },
    once: { value: function (event, handler) {
      var called = false
      var done = function () {
        if (!called) {
          called = true
          handler.apply(null, arguments)
        }
      }
      httpsServer.once(event, done)
      httpServer.once(event, done)
    }},

    setMaxListeners: { value: both('setMaxListeners')},
    removeListener: { value: both('removeListener')},
    removeAllListeners: { value: both('removeAllListeners')},
    setTimeout: { value: both('setTimeout')},
    ref: { value: both('ref')},
    unref: { value: both('unref')},

    // We use the https address because its likely to fit
    address: { value: httpsServer.address.bind(httpsServer)},

    // Since we are listening on both servers we don't need
    // an emit to be processed twice
    emit: { value: httpsServer.emit.bind(httpsServer)},

    // The amount and order of listeners should be same
    listeners: { value: httpsServer.listeners.bind(httpsServer)},
    listenerCount: { value: httpsServer.listenerCount.bind(httpsServer)},
    getMaxListeners: { value: httpsServer.getMaxListeners.bind(httpServer)},

    // Need to wait until both are closed
    close: { value: function (callback) {
      httpServer.close(function () {
        httpsServer.close(callback)
      })
    }},
    listen: { value: function () {
      throw new Error('not-supported')
    }},
    getConnections: { value: function (callback) {
      httpServer.getConnections(function (err, httpConnections) {
        if (err) return callback(err)
        httpsServer.getConnections(function (err, httpsConnections) {
          if (err) return callback(err)
          callback(null, httpConnections + httpsConnections)
        })
      })
    }},
    connections: {
      get: function () {
        if (isNaN(httpServer.connections) || isNaN(httpsServer.connections)) {
          return null
        }
        return httpServer.connections + httpsServer.connections
      }
    },
    timeout: {
      get: function () { return httpServer.timeout },
      set: function (timeout) {
        httpServer.timeout = timeout
        httpsServer.timeout = timeout
      }
    },
    maxHeadersCount: {
      get: function () { return httpServer.maxHeadersCount * 2 },
      set: function (count) {
        var c2 = count / 2
        httpServer.maxHeadersCount = c2
        httpsServer.maxHeadersCount = c2
      }
    }
  })

  CombinedServer.on

  return CombinedServer

  function both(property, ignoreSecond) {
    if (ignoreSecond === false) {
      return httpsServer[property].bind(httpServer)
    }
    return function () {
      httpServer[property].apply(httpServer, arguments)
      httpsServer[property].apply(httpsServer, arguments)
    }
  }

  /**
   * Attempts to load or create a certificate for a hostname.
   *
   * @param {String} hostname
   * @return {Promise}
   */
  function SNICallback (hostname, done) {
    // Check valid domain list to ensure this hostname is accepted.
    if (Array.isArray(opts.domains)) {
      if (!opts.domains.some(function (domain) { return domain.test(hostname) })) {
        return done(new Error('AutoSNI: Unlisted domain requested.'))
      }
    }

    // Load or create an ssl cert for a domain.
    load(hostname, opts).then(function (credentials) {
      done(null, tls.createSecureContext(credentials))
    }).catch(done)
  }

  /**
   * Handles an incomming http(s) request and fullfils any acme challenges.
   */
  function handleChallenge (req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return handler(req, res)
    fileServer.serve(req, res, function () {
      // If we served our ACME challenge then we don't need to continue.
      if (res.headersSent) return
      // Automatically ensure that each request is handled with https.
      if (opts.forceSSL && !req.connection.encrypted) {
        var host = req.headers.host.split(':')[0] + ':' + ports.https
        res.writeHead(302, { 'Location': 'https://' + host + req.url })
        return res.end()
      }
      // Let request through to provided handler.
      handler(req, res)
    })
  }
}
