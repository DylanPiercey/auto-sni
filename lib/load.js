"use strict";

var fs             = require("mz/fs");
var cp             = require("mz/child_process");
var mkdirp         = require("mkdirp-promise");
var path           = require("path");
var safe           = require("safetimeout");
var LE             = require("letsencrypt");
var CONSTANTS      = require("./constants");
var STATIC_PATH    = CONSTANTS.STATIC_PATH;
var CHALLENGE_PATH = CONSTANTS.CHALLENGE_PATH;
var EXPIRE_TIME    = CONSTANTS.EXPIRE_TIME;
var lock           = {};
module.exports     = load;

// Handles for ACME challenges.
var handlers = {
	setChallenge: function (args, key, value, done) {
		var keyfile = path.join(CHALLENGE_PATH, key);
		return fs.writeFile(keyfile, value, "utf8")
			.then(done.bind(null))
			.catch(done);
	},
	removeChallenge: function (args, key, done) {
		var keyfile = path.join(CHALLENGE_PATH, key);
		return fs.unlink(keyfile)
			.then(done.bind(null))
			.catch(done);
	}
};

/**
 * Attempts to register a hostname with letsencrypt.
 *
 * @param {Object} opts
 * @return {Promise}
 */
function load (hostname, opts) {
	// Lock to ensure we are not fetching a host multiple times.
	if (lock[hostname]) return lock[hostname];
	var port      = Number(process.env.PORT || 80);
	var stdio     = opts.debug ? "pipe" : "ignore";
	var configDir = path.join(process.env.HOME, "/letsencrypt/etc");
	var liveDir   = path.join(configDir, "live", hostname);
	var args      = {
		manual:        true,
		debug:         opts.debug,
		configDir:     configDir,
		privkeyPath:   defaults("privkeyPath"),
		chainPath:     defaults("chainPath"),
		fullchainPath: defaults("fullchainPath"),
		certPath:      defaults("certPath")
	};

	return lock[hostname] = Promise.all([
		// Load certs.
		fs.readFile(args.privkeyPath, "ascii"),
		fs.readFile(args.certPath, "ascii"),
		// Check cert expiry.
		fs.stat(args.certPath)
	])
		.then(function checkCertExpiry (data) {
			var key   = data[0];
			var cert  = data[1];
			var stat  = data[2];
			var ttl = EXPIRE_TIME - (+new Date - stat.mtime);
			// Check for expired cert.
			if (ttl <= 0) throw new Error("AutoSNI: Certificate Expired.");
			// Remove cert later.
			safe.setTimeout(function () { lock[hostname] = null; }, ttl);
			return {
				key: key,
				cert: cert
			};
		})
		.catch(function createNewCert () {
			return mkdirp(liveDir)
				.then(function () {
					// Create a new self signed cert, privkey and chain.
					return cp.exec(
						"openssl req -x509 -newkey rsa:2048 -keyout privkey.pem -out cert.pem -days 90 -nodes -subj '/CN=" + hostname + "'" +
						" && cat privkey.pem cert.pem > chain.pem",
						{ cwd: liveDir, stdio: stdio }
					);
				})
				.then(function () {
					return new Promise(function (accept, reject) {
						return LE.create(args, handlers).register({
							agreeTos:     true,
							duplicate:    true, // This is only called if the cert is missing anyway.
							domains:      [hostname],
							email:        opts.email,
							webrootPath:  STATIC_PATH,
							http01Port:   port,
							tlsSni01Port: port,
							server:       process.env.NODE_ENV === "production"
								? LE.productionServerUrl
								: LE.stagingServerUrl
						}, function (err, info) {
							if (err) reject(err);
							else accept(info);
						});
					});
				});
		})
		.catch(function logError (err) {
			console.error("AutoSNI Error:", err);
			console.error("Will fall back to self signed certificate.");
		})
		.then(function maybeRetryLoadCert (info) {
			if (!info) {
				lock[hostname] = null;
				return load(hostname, opts);
			}
			return info;
		});

	function defaults (key) {
		return LE[key]
			.replace(":config", configDir)
			.replace(":hostname", hostname);
	}
}

