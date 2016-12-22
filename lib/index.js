'use strict'

var isType = require('is-typeof')
// var serveStatic = require('serve-static')
var LE = require('letsencrypt')
var LE_EXPRESS = require('letsencrypt-express')
// var CONSTANTS = require('./constants')
// var STATIC_PATH = CONSTANTS.STATIC_PATH

// Expose http and https so that they can be overwriten.
// createServer.http = require('http')
// createServer.https = require('https')

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

  if (!('ip' in opts)) opts.ip = '0.0.0.0'
  if (!('http' in ports)) ports.http = 80
  if (!('https' in ports)) ports.https = 443
  if (!opts.email) throw new TypeError('AutoSNI: Email is required.')
  if (!opts.agreeTos) throw new TypeError('AutoSNI: Must agree to LE TOS.')
  if (!hostnames.length && !bundles.length) throw new TypeError('AutoSNI: Domains option must be a non-empty array.')

  return LE_EXPRESS.create({
    server: opts.debug ? LE.stagingServerUrl : LE.productionServerUrl,
    email: opts.email,
    agreeToTerms: opts.agreeTos,
    approveDomains: opts.domains,
    debug: opts.debug,
    app: handler
  }).listen(ports.http, ports.https)

  // /**
  //  * Verifies that a hostname is in the domain list or in a bundle.
  //  *
  //  * @param {String} hostname - the hostname to look for.
  //  * @returns {Array} - list of hostname for the certificate.
  //  */
  // function findBundle (hostname) {
  //   // Look through regular hostnames
  //   if (~hostnames.indexOf(hostname)) return [hostname]
  //
  //   // Look through bundled hostnames.
  //   var bundle
  //   for (var i = bundles.length; i--;) {
  //     bundle = bundles[i]
  //     if (~bundle.indexOf(hostname)) return bundle
  //   }
  // }
}
