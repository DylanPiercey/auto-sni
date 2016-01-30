"use strict";

var cp          = require("mz/child_process");
var net         = require("net");
var tls         = require("tls");
var http        = require("http");
var https       = require("https");
var Server      = require("node-static").Server;
var toReg       = require("path-to-regexp");
var load        = require("./load");
var CONSTANTS   = require("./constants");
var STATIC_PATH = CONSTANTS.STATIC_PATH;
var EXPIRE_TIME = CONSTANTS.EXPIRE_TIME;

module.exports = createServer;

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
	if (!("ip" in opts)) opts.ip = "0.0.0.0";
	if (!("http" in ports)) ports.http = 80;
	if (!("https" in ports)) ports.https = 443;

	if (Array.isArray(opts.domains)) {
		opts.domains = opts.domains.map(function (domain) {
			return toReg(domain, [], { strict: true });
		});
	}

	return Promise.all([
		checkPort(ports.http),
		checkPort(ports.https)
	])
		.catch(function (e) {
			if (e.code !== "EACCES" || !process.platform === "linux") {
				console.error("AutoSNI: Error starting secure server.");
				console.error(e);
				throw e;
			}

			// If we are in linux we can attempt to open low ports automatically.
			// TODO: Figure out a way to do this in osx/windows.
			console.error("AutoSNI: insufficient access to ports.", ports, e);
			console.error("Enter your password below to permentantly grant this user access to these ports.");
			return cp.exec("sudo setcap cap_net_bind_service=+ep $(which node)").catch(function (e) {
				console.error("AutoSNI: Error opening ports.", e);
			});
		})
		.then(function () {
			// Start up a file server for webroot challenges.
			var fileServer = new Server(STATIC_PATH);

			return Promise.all([
				// Create an https server.
				listen(
					https.createServer({ SNICallback: SNICallback }, challengeHandler),
					ports.https, opts.ip
				),
				// Create an http server.
				listen(
					http.createServer(challengeHandler),
					ports.http, opts.ip
				)
			]);

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
						var host = req.headers.host.split(":")[0] + ":" + ports.https;
						res.writeHead(302, { "Location": "https://" + host + req.url });
						return res.end();
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
				if (Array.isArray(opts.domains)) {
					if (!opts.domains.some(function (domain) { return domain.test(hostname) })) {
						return done(new Error("AutoSNI: Unlisted domain requested."));
					}
				}

				load(hostname, opts).then(function (credentials) {
					done(null, tls.createSecureContext(credentials));
				}).catch(done);
			}
		});
}

/**
 * Listens to a server and resolves a promise once it is running.
 */
function listen (server, port, ip) {
	return new Promise(function (accept, reject) {
		server.once("error", reject);
		server.listen(port, ip, function () {
			accept();
		});
	});
}

/**
 * Utility to check if the current user can access the provided port.
 */
function checkPort (port) {
	var server = net.createServer();
	server.unref();
	return new Promise(function (accept, reject) {
		server.once("error", reject);
		server.listen(port, function () {
			server.close(accept);
		});
	});
}
