"use strict";

var cp          = require("mz/child_process");
var net         = require("net");
var tls         = require("tls");
var http        = require("http");
var https       = require("https");
var Server      = require("node-static").Server;
var load        = require("./load");
var CONSTANTS   = require("./constants");
var STATIC_PATH = CONSTANTS.STATIC_PATH;
var EXPIRE_TIME = CONSTANTS.EXPIRE_TIME;

module.exports = { createServer: createServer };

/**
 * Like nodes https.createServer but will automatically generate certificates from letsencrypt
 * falling back to self signed.
 *
 * @param {Object} opts
 * @param {Function} handler
 * @return {Server}
 */
function createServer (opts, handler) {
	opts = opts || {};
	var ports = opts.ports || {};

	if (!("email" in opts)) throw new TypeError("AutoSNI: Email is required.");
	if (!("agreeTos" in opts)) throw new TypeError("AutoSNI: Must agree to LE TOS.");
	if (!("ip" in opts.ip)) opts.ip = "0.0.0.0";
	if (!("http" in ports)) ports.http = 80;
	if (!("https" in ports)) ports.https = 443;

	return Promise.all([
		checkPort(ports.http),
		checkPort(ports.https)
	])
		.catch(function (e) {
			if (e.code !== "EACCES") {
				console.error("AutoSNI: Error starting secure server.");
				console.error(e);
				throw e;
			}

			console.error("AutoSNI: insufficient access to ports.", opts.ports);
			console.error("Enter your password below to permentantly grant this user access to these ports.");
			return cp.exec("sudo setcap cap_net_bind_service=+ep $(which node)");
		})
		.then(function () {
			// Start up a file server for webroot challenges.
			var fileServer  = new Server(STATIC_PATH);

			// Create an https server.
			https
				.createServer({ SNICallback: SNICallback }, challengeHandler)
				.listen(ports.https, opts.ip);

			// Create an http server.
			http
				.createServer(challengeHandler)
				.listen(ports.http, opts.ip);
		});

	/**
	 * Handles an incomming http(s) request and fullfils any acme challenges.
	 */
	function challengeHandler (req, res) {
		if (req.method !== "GET" && req.method !== "HEAD") return handler(req, res);
		fileServer.serve(req, res, function () {
			// If we served our ACME challenge then we don't need to continue.
			if (res.headersSent) return;
			// Automatically ensure that each request is handled with https.
			if (!req.connection.encrypted) {
				res.setHeader("Location", "https://" + req.headers.host + req.url);
				return;
			}
			// Let request through to provided handler.
			handler(req, res);
		});
	}

	/**
	 * Attempts to load or create a certificate for a hostname.
	 *
	 * @param {String} hostname
	 * @return {Promise}
	 */
	function SNICallback (hostname, done) {
		load(hostname, opts).then(function (credentials) {
			done(null, tls.createSecureContext(credentials));
		}).catch(done);
	}
}

/**
 * Utility to check if the current user can access the provided port.
 */
function checkPort (port) {
	var server = net.createServer();
	server.unref();
	return new Promise(function (accept, reject) {
		server.on("error", reject);
		server.listen(port, function () {
			server.close(accept);
		});
	});
}
