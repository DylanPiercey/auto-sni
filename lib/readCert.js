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

function readCert (hostname, opts) {
	if (lock[hostname]) return lock[hostname];
	var certPath = path.join(CERT_PATH, hostname);
	var stdio    = opts.debug ? "pipe" : "ignore";
	return lock[hostname] = fs.stat(certPath)
		.then(function (stats) {
			var age = +new Date - stats.mtime;
			if (age > EXPIRE_TIME) throw new Error("AutoSNI: Expired certificate.");
			return Promise.all([
				fs.readFile(path.join(certPath, "/cert.pem")),
				fs.readFile(path.join(certPath, "/key.pem")),
			]).then(function (data) {
				setTimeout(function () { delete lock[hostname]; }, EXPIRE_TIME - age);
				return {
					created: stats.mtime,
					cert:    data[0],
					key:     data[1]
				}
			})
		})
		.catch(function (err) {
			return cp.exec(
				"rm -rf " + certPath + " && mkdir " + certPath,
				{ stdio: stdio }
			)
				.then(function () {
					return cp.exec(
						"openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 90 -nodes -subj '/CN=" + hostname + "'",
						{ cwd: certPath, stdio: stdio }
					)
						.then(function () { return register(hostname, opts) })
						.catch(function (err) {
							console.error("AutoSNI Error:", err);
							console.error("Will fall back to self signed certificate.");
						});
				})
				.then(function () {
					delete lock[hostname];
					return readCert(hostname, opts);
				});
		});
}

