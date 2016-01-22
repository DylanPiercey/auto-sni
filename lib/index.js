"use strict";

var tls         = require("tls");
var http        = require("http-both");
var Server      = require("node-static").Server;
var readCert    = require("./readCert");
var STATIC_PATH = require("./constants").STATIC_PATH;

module.exports = { createServer: createServer };

function createServer (opts, handler) {
	var fileServer = new Server(STATIC_PATH);
	var cache      = {};

	if (!opts || typeof opts.email !== "string") {
		throw new TypeError("Email option is required for autosni.");
	}

	return http.createServer({ SNICallback: SNICallback }, function (req, res) {
		if (req.method !== "GET" && req.method !== "HEAD") return handler(req, res);

		fileServer.serve(req, res, function () {
			if (res.headersSent) return;
			handler(req, res);
		});
	});

	function SNICallback (hostname, done) {
		var credentials = cache[hostname] || {};
		var age = +new Date - credentials.created;

		if (age <= 5.256e+9) return done(null, tls.createSecureContext(credentials));

		return readCert(opts.email, hostname)
			.then(function (newCredentials) {
				cache[hostname] = newCredentials;
				done(null, tls.createSecureContext(newCredentials));
			})
			.catch(function (err) {
				console.error(err);
				done(err);
			});
	}
}
