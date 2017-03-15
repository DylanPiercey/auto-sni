'use strict'

var fs = require('mz/fs')
var cp = require('mz/child_process')
var Promise = require('bluebird')
var mkdirp = require('mkdirp-then')
var path = require('path')
var safe = require('safetimeout')
var LE = require('letsencrypt')
var CONSTANTS = require('./constants')
var STATIC_PATH = CONSTANTS.STATIC_PATH
var CHALLENGE_PATH = CONSTANTS.CHALLENGE_PATH
var EXPIRE_TIME = CONSTANTS.EXPIRE_TIME
var lock = {}
module.exports = load

// Handles for ACME challenges.
var handlers = {
  setChallenge: function (args, key, value, done) {
    var keyfile = path.join(CHALLENGE_PATH, key)
    return fs.writeFile(keyfile, value, 'utf8')
      .then(done.bind(null))
      .catch(done)
  },
  removeChallenge: function (args, key, done) {
    var keyfile = path.join(CHALLENGE_PATH, key)
    return fs.unlink(keyfile)
      .then(done.bind(null))
      .catch(done)
  }
}

/**
 * Attempts to register a hostname with letsencrypt.
 *
 * @param {Object} opts
 * @return {Promise}
 */
function load (domains, opts) {
  var hostname = domains[0]
  // Lock to ensure we are not fetching a host multiple times.
  if (lock[hostname]) return lock[hostname]
  var stdio = opts.debug ? 'pipe' : 'ignore'
  var configDir = path.join(process.env.HOME ? process.env.HOME : process.env.USERPROFILE, '/letsencrypt/etc')
  var liveDir = path.join(configDir, 'live', hostname)
  var liveOptsDir = path.join(liveDir, 'opts.json')
  var logsDir = path.join(configDir, 'letsencrypt.logs')
  var workDir = path.join(configDir, 'letsencrypt.work')
  var args = {
    manual: true,
    debug: opts.debug,
    server: opts.debug ? LE.stagingServerUrl : LE.productionServerUrl,
    configDir: configDir,
    privkeyPath: defaults('privkeyPath'),
    chainPath: defaults('chainPath'),
    fullchainPath: defaults('fullchainPath'),
    certPath: defaults('certPath')
  }

  var hostLock = Promise.all([
    // Load certs.
    fs.readFile(args.privkeyPath, 'ascii'),
    fs.readFile(args.fullchainPath, 'ascii'),
    // Check cert options (debug/bundle)
    fs.readFile(liveOptsDir, 'utf8'),
    // Check cert expiry.
    fs.stat(args.fullchainPath)
  ])
    .then(function checkCertExpiryAndOptions (data) {
      var key = data[0]
      var cert = data[1]
      var prevOpts = JSON.parse(data[2])
      var stat = data[3]
      var ttl = EXPIRE_TIME - (+new Date() - stat.mtime)

      // Check for expired cert.
      if (ttl <= 0) throw new Error('AutoSNI: Certificate Expired.')
      // Check if we are switching from debug to live or vice versa.
      if (prevOpts.debug !== opts.debug) throw new Error('AutoSNI: Switching debug modes.')
      // Check if the domains we have is different.
      if (prevOpts.domains !== String(domains)) throw new Error('AutoSNI: Domain bundle changed.')

      // Remove cert later.
      safe.setTimeout(function () { lock[hostname] = null }, ttl)
      // Return an existing cert.
      return { key: key, cert: cert }
    })
    .catch(function registerOrRenewCert () {
      return mkdirp(liveDir)
        .then(function createFallBackCert () {
          var curOpts = JSON.stringify({ domains: String(domains), debug: opts.debug })
          // Create a new self signed cert, privkey and chain.
          // Also stores some important options that can require recreating a cert.
          return cp.exec(
            // Create the private key and a self signed cert.
            "openssl req -x509 -newkey rsa:2048 -keyout privkey.pem -out cert.pem -days 90 -nodes -subj '" +
              '/CN=' + hostname +
              '/emailAddress=' + opts.email +
            "'" +
            // Create a chain for the self signed cert.
            ' && cat privkey.pem cert.pem | tee -a chain.pem fullchain.pem' +
            // Store current cert options.
            ' && echo \'' + curOpts + '\' > opts.json',
            { cwd: liveDir, stdio: stdio }
          )
        })
        .then(function createLetsEncryptCert () {
          return new Promise(function (resolve, reject) {
            LE.create(args, handlers).register({
              agreeTos: true,
              duplicate: true, // This is only called if the cert is missing anyway.
              domains: domains,
              email: opts.email,
              webrootPath: STATIC_PATH,
              http01Port: opts.ports.http,
              tlsSni01Port: opts.ports.https,
              logsDir: logsDir,
              workDir: workDir
            }, function (err, info) {
              if (err) reject(err)
              else resolve(info)
            })
          })
        })
    })
    .catch(function logError (err) {
      console.error('AutoSNI LetsEncrypt Error:', err)
      console.error('Will fall back to self signed certificate.')
    })
    .then(function maybeRetryLoadCert (info) {
      if (!info) {
        lock[hostname] = null
        return load(domains, opts)
      }
      return info
    })

  lock[hostname] = hostLock
  return hostLock

  function defaults (key) {
    return LE[key]
      .replace(':config', configDir)
      .replace(':hostname', hostname)
  }
}
