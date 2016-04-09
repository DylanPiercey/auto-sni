'use strict'

var tls = require('tls')
var Server = require('node-static').Server
var toReg = require('path-to-regexp')
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
  var ports = opts.ports = opts.ports || {}
  var http = createServer.http
  var https = createServer.https

  if (!('ip' in opts)) opts.ip = '0.0.0.0'
  if (!('http' in ports)) ports.http = 80
  if (!('https' in ports)) ports.https = 443
  if (!('forceSSL' in opts)) opts.forceSSL = true
  if (!opts.email) throw new TypeError('AutoSNI: Email is required.')
  if (!opts.agreeTos) throw new TypeError('AutoSNI: Must agree to LE TOS.')

  // Convert allowed domains to regexps.
  if (Array.isArray(opts.domains)) {
    opts.domains = opts.domains.map(function (domain) {
      return toReg(domain, [], { strict: true })
    })
  }

  // Start up a file server for webroot challenges.
  var fileServer = new Server(STATIC_PATH)
  // Create the secure server.
  var httpsServer = https.createServer({ SNICallback: SNICallback }, handler)
  // Create a http -> https server.
  var httpServer = httpsServer.http = http.createServer(handleChallenge).unref()

  // Special case for restify servers.
  if (httpsServer.server) httpsServer = httpsServer.server

  // Start the secure server.
  httpsServer
    .once('close', httpServer.close.bind(httpServer))
    .listen(ports.https, opts.ip)

  // Start the http -> https server.
  httpServer
    .on('error', httpsServer.emit.bind(httpsServer, 'error'))
    .listen(ports.http, opts.ip)

  return httpsServer

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
    if (!opts.forceSSL && req.method !== 'GET' && req.method !== 'HEAD') {
      httpsServer.emit('request', req, res)
      return
    }

    fileServer.serve(req, res, function () {
      // If we served our ACME challenge then we don't need to continue.
      if (res.headersSent) return
      if (opts.forceSSL && req.headers.host) {
        // Automatically ensure that each request is handled with https.
        var host = req.headers.host.split(':')[0] + ':' + ports.https
        res.writeHead(302, { 'Location': 'https://' + host + req.url })
        res.end()
      } else {
        // Let request through to provided https-server.
        httpsServer.emit('request', req, res)
      }
    })
  }
}
