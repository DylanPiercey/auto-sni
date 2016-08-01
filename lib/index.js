'use strict'

var tls = require('tls')
var isType = require('is-typeof')
var serveStatic = require('serve-static')
var load = require('./load')
var CONSTANTS = require('./constants')
var STATIC_PATH = CONSTANTS.STATIC_PATH

// Expore http and https so that they can be overwriten.
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
  var domains = opts.domains || []
  var ports = opts.ports = opts.ports || {}
  var hostnames = domains.filter(isType.string)
  var bundles = domains.filter(isType.array)
  var http = createServer.http
  var https = createServer.https
  var httpsServerOptions = { SNICallback: SNICallback }

  if (!('ip' in opts)) opts.ip = '0.0.0.0'
  if (!('http' in ports)) ports.http = 80
  if (!('https' in ports)) ports.https = 443
  if (!('forceSSL' in opts)) opts.forceSSL = true
  if (!('redirectCode' in opts)) opts.redirectCode = 302
  if (opts.redirectCode !== 301 && opts.redirectCode !== 302) throw new TypeError('AutoSNI: RedirectCode must be either 301 or 302')
  if (!opts.email) throw new TypeError('AutoSNI: Email is required.')
  if (!opts.agreeTos) throw new TypeError('AutoSNI: Must agree to LE TOS.')
  if (!hostnames.length && !bundles.length) throw new TypeError('AutoSNI: Domains option must be a non-empty array.')

  // Restify has a special property for https servers.
  if (opts.restify) {
    httpsServerOptions = { httpsServerOptions: httpsServerOptions }
  }

  // Start up a file server for webroot challenges.
  var serve = serveStatic(STATIC_PATH)
  // Create the secure server.
  var httpsServer = https.createServer(httpsServerOptions, handler)
  // Create a http -> https server.
  var httpServer = httpsServer.http = http.createServer(handleChallenge)

  // Do some dancing to make restify work.
  if (opts.restify) {
    // Store restify server.
    var restifyServer = httpsServer
    // Mark restify as secure (httpsServerOptions does not do this automatically).
    restifyServer.secure = true
    // Pull out plain https server from restify.
    httpsServer = httpsServer.server
  }

  // Start the secure server.
  httpsServer
    .once('close', httpServer.close.bind(httpServer))
    .listen(ports.https, opts.ip)

  // Start the http -> https server.
  httpServer
    .on('error', httpsServer.emit.bind(httpsServer, 'error'))
    .listen(ports.http, opts.ip)
    .unref()

  return restifyServer || httpsServer

  /**
   * Attempts to load or create a certificate for a hostname.
   *
   * @param {String} hostname
   * @return {Promise}
   */
  function SNICallback (hostname, done) {
    var bundle = findBundle(hostname)

    // Check valid domain to ensure this hostname is accepted.
    if (!bundle) return done(new Error('AutoSNI: Unlisted domain requested.'))

    // Load or create an ssl cert for a domain.
    load(bundle, opts).then(function (credentials) {
      done(null, tls.createSecureContext(credentials))
    }).catch(done)
  }

  /**
   * Handles an incomming http(s) request and fullfils any acme challenges.
   */
  function handleChallenge (req, res) {
    if (!opts.forceSSL && req.method !== 'GET' && req.method !== 'HEAD') {
      httpsServer.emit('request', req, res)
      return
    }

    serve(req, res, function () {
      // If we didn't served a ACME challenge then we continue.
      if (opts.forceSSL && req.headers.host) {
        // Automatically ensure that each request is handled with https.
        var host = req.headers.host.split(':')[0] + ':' + ports.https
        var httpCode = opts.redirectCode
        res.writeHead(httpCode, { 'Location': 'https://' + host + req.url })
        res.end()
      } else {
        // Let request through to provided https-server.
        httpsServer.emit('request', req, res)
      }
    })
  }

  /**
   * Verifies that a hostname is in the domain list or in a bundle.
   *
   * @param {String} hostname - the hostname to look for.
   * @returns {Array} - list of hostname for the certificate.
   */
  function findBundle (hostname) {
    // Look through regular hostnames
    if (~hostnames.indexOf(hostname)) return [hostname]

    // Look through bundled hostnames.
    var bundle
    for (var i = bundles.length; i--;) {
      bundle = bundles[i]
      if (~bundle.indexOf(hostname)) return bundle
    }
  }
}
