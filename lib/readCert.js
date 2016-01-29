"use strict";

var fs          = require("mz/fs");
var cp          = require("mz/child_process");
var path        = require("path");
var register    = require("./register");
var CONSTANTS   = require("./constants");
var CERT_PATH   = CONSTANTS.CERT_PATH;
var EXPIRE_TIME = CONSTANTS.EXPIRE_TIME;
var lock        = {};
module.exports  = readCert;

/**
 * Attempts to load or create an ssl certificate with LE or self signed.
 *
 * @param {String} hostname
 * @param {Object} opts
 * @return {Promise}
 */
function readCert (hostname, opts) {
	// Lock to ensure we are not fetching a host multiple times.
	if (lock[hostname]) return lock[hostname];

	var certPath = path.join(CERT_PATH, hostname);
	var stdio    = opts.debug ? "pipe" : "ignore";

	return lock[hostname] = fs.stat(certPath)
		.then(function (stats) {
			// Check for expired cert.
			var age = +new Date - stats.mtime;
			if (age > EXPIRE_TIME) throw new Error("AutoSNI: Expired certificate.");

			// Load cert and key.
			return Promise.all([
				fs.readFile(path.join(certPath, "/cert.pem")),
				fs.readFile(path.join(certPath, "/key.pem")),
			]).then(function (data) {
				// Remove cert later.
				setTimeout(function () { delete lock[hostname]; }, EXPIRE_TIME - age);
				return {
					cert:    data[0],
					key:     data[1]
				}
			})
		})
		.catch(function (err) {
			// Attempt to create a new cert.
			return cp.exec(
				"rm -rf " + certPath + " && mkdir " + certPath,
				{ stdio: stdio }
			)
				.then(function () {
					// Create self signed cert and private key.
					return cp.exec(
						"openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 90 -nodes -subj '/CN=" + hostname + "'",
						{ cwd: certPath, stdio: stdio }
					)
						// Attempt to create LE cert.
						.then(function () { return register(hostname, opts) })
						.catch(function (err) {
							console.error("AutoSNI Error:", err);
							console.error("Will fall back to self signed certificate.");
						});
				})
				.then(function () {
					// After a cert has been made we try to read it again.
					delete lock[hostname];
					return readCert(hostname, opts);
				});
		});
}

