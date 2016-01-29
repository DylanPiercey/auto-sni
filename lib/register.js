"use strict";

var fs             = require("fs");
var path           = require("path");
var LE             = require("letsencrypt");
var CONSTANTS      = require("./constants");
var CERT_PATH      = CONSTANTS.CERT_PATH;
var STATIC_PATH    = CONSTANTS.STATIC_PATH;
var CHALLENGE_PATH = CONSTANTS.CHALLENGE_PATH;
module.exports     = register;

// Handles for ACME challenges.
var handlers = {
	setChallenge: function (args, key, value, cb) {
		var keyfile = path.join(CHALLENGE_PATH, key);
		fs.writeFile(keyfile, value, "utf8", cb);
	},
	removeChallenge: function (args, key, cb) {
		var keyfile = path.join(CHALLENGE_PATH, key);
		fs.unlink(keyfile, cb);
	}
};

/**
 * Attempts to register a hostname with letsencrypt.
 *
 * @param {String} hostname
 * @param {Object} opts
 * @return {Promise}
 */
function register (hostname, opts) {
	var dir = path.join(CERT_PATH, hostname);
	var port = Number(process.env.PORT || 80);
	return new Promise(function (accept, reject) {
		return LE.create({
			manual:        true,
			debug:         opts.debug,
			configDir:     opts.configDir,
			privkeyPath:   path.join(dir, "key.pem"),
			chainPath:     path.join(dir, "cert.pem"),
			fullchainPath: path.join(dir, "cert.pem"),
			certPath:      path.join(dir, "cert.pem")
		}, handlers).register({
			agreeTos:     true,
			domains:      [hostname],
			email:        opts.email,
			duplicate:    opts.duplicate,
			webrootPath:  STATIC_PATH,
			http01Port:   port,
			tlsSni01Port: port,
			server:       process.env.NODE_ENV === "production"
				? "https://acme-v01.api.letsencrypt.org/directory"
				: "https://acme-staging.api.letsencrypt.org/directory"
		}, function (err, results) {
			if (err) return reject(err);
			accept(results);
		})
	});
}
