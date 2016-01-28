"use strict";

var tls         = require("tls");
var http        = require("http-both");
var Server      = require("node-static").Server;
var readCert    = require("./readCert");
var CONSTANTS   = require("./constants");
var STATIC_PATH = CONSTANTS.STATIC_PATH;
var EXPIRE_TIME = CONSTANTS.EXPIRE_TIME;

module.exports = { createServer: createServer };

function createServer (opts, handler) {
	var fileServer = new Server(STATIC_PATH);
	if (opts == null) opts = {};
	if (!("email" in opts)) throw new TypeError("AutoSNI: Email is required.");
	if (!("agreeTos" in opts)) throw new TypeError("AutoSNI: Must agree to LE TOS.");
	if (!("configDir" in opts)) opts.configDir = "~/letsencrypt/etc/";

	return http.createServer({ SNICallback: SNICallback }, function (req, res) {
		if (req.method !== "GET" && req.method !== "HEAD") return handler(req, res);

		fileServer.serve(req, res, function () {
			if (res.headersSent) return;
			handler(req, res);
		});
	});

	function SNICallback (hostname, done) {
		return readCert(hostname, opts)
			.then(function (credentials) {
				done(null, tls.createSecureContext(credentials));
			})
			.catch(function (err) {
				console.error(err);
				done(err);
			});
	}
}
