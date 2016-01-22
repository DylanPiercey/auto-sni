"use strict";

var fs           = require("mz/fs");
var cp           = require("mz/child_process");
var path         = require("path");
var CONSTANTS    = require("./constants");
var CERT_PATH    = CONSTANTS.CERT_PATH;
var STATIC_PATH  = CONSTANTS.STATIC_PATH;
var ENCRYPT_PATH = CONSTANTS.ENCRYPT_PATH;

// Ensure cert path exists.
try { fs.accessSync(CERT_PATH); }
catch (_) { fs.mkdirSync(CERT_PATH); }

module.exports = ~["production", "staging"].indexOf(String(process.env.NODE_ENV).toLowerCase())
	? readProductionCert
	: readDevelopmentCert;

function readProductionCert (email, hostname) {
	var certPath = path.join(CERT_PATH, hostname);
	return readCert(certPath, function () {
		return cp.exec(
			"openssl req -x509 -newkey rsa:2048 -keyout key.pem -days 90 -nodes -subj '/CN=" + hostname + "'",
			{ cwd: certPath, stdio: "ignore" }
		)
			.then(function () {
				return cp.exec(
					ENCRYPT_PATH +
						" certonly" +
						" --email " + email +
						" --domains " + hostname +
						" --duplicate" +
						" --agree-tos" +
						" --debug" +
						" --tls-sni-01-port " + (process.env.PORT || "80") +
						" --http-01-port " + (process.env.PORT || "80") +
						" --rsa-key-size 2048" +
						" --cert-path " + path.join(certPath, "cert.pem") +
						" --fullchain-path " + path.join(certPath, "fullchain.pem") +
						" --chain-path " + path.join(certPath, "chain.pem") +
						" --domain-key-path " + path.join(certPath, "key.pem") +
						" --server https://acme-staging.api.letsencrypt.org/directory" +
						" --webroot" +
						" --webroot-path " + STATIC_PATH
				);
			});
	});
}

function readDevelopmentCert (email, hostname) {
	var certPath = path.join(CERT_PATH, hostname);
	return readCert(certPath, function () {
		return cp.exec(
			"openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 9999 -nodes -subj '/CN=" + hostname + "'",
			{ cwd: certPath, stdio: "ignore" }
		);
	});
}

function readCert (certPath, fallback) {
	return fs.stat(certPath)
		.then(function (stats) {
			var age = +new Date - stats.mtime;
			if (age > 5.256e+9) {
				return cp.exec("rm -rf " + certPath, { cwd: CERT_PATH })
					.then(function () { return readCert(certPath, fallback); });
			}
			return Promise.all([
				fs.readFile(path.join(certPath, "/cert.pem")),
				fs.readFile(path.join(certPath, "/key.pem")),
			]).then(function (data) {
				return {
					created: stats.mtime,
					cert:    data[0],
					key:     data[1]
				}
			})
		})
		.catch(function () {
			return fs.mkdir(certPath)
				.then(fallback)
				.catch(fallback);
		});
}
