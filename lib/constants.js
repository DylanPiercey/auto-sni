"use strict";

var path   = require("path");
var findNM = require("find-node-modules");

module.exports = {
	CERT_PATH:    path.join(process.env.HOME, ".auto-sni"),
	STATIC_PATH:  path.join(__dirname, "../static"),
	ENCRYPT_PATH: path.join(__dirname, "../" + findNM()[0] + "/.bin/letsencrypt"),
	EXPIRE_TIME:  6.912e+9
};
