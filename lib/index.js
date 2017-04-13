'use strict'

var path = require('path')
var LE = require('greenlock-express')
var DEFAULT_DIR = path.join(require('os').homedir(), '/letsencrypt/etc')
var noop = function () {}

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
function createServer (opts, app) {
  opts = opts || {}
  app = app || noop
  var handler = null
  var domains = opts.domains || []
  var ports = opts.ports = opts.ports || {}
  if (!('http' in ports)) ports.http = 80
  if (!('https' in ports)) ports.https = 443
  if (!opts.email) throw new TypeError('AutoSNI: Email is required.')
  if (!opts.agreeTos) throw new TypeError('AutoSNI: Must agree to LE TOS.')
  if (!domains.length) throw new TypeError('AutoSNI: Domains option must be a non-empty array.')
  if (typeof app === 'function') {
    // Allow passing in handler function directly.
    handler = app
  } else if (typeof app.emit === 'function') {
    // Allow passing in another node server (forwards requests).
    handler = function (req, res) {
      app.emit('request', req, res)
    }
  } else {
    throw new TypeError('AutoSNI: Invalid app provided.')
  }

  return LE.create({
    app: handler,
    debug: opts.debug,
    email: opts.email,
    agreeTos: opts.agreeTos,
    server: opts.debug ? 'staging' : 'production',
    configDir: opts.dir || DEFAULT_DIR,
    approveDomains: opts.domains
  }).listen(opts.ports.http, opts.ports.https)
}
