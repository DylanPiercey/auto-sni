"use strict";

var fs   = require("mz/fs");
var path = require("path");

var CERT_PATH       = path.join(process.env.HOME, ".auto-sni");
var STATIC_PATH     = path.join(__dirname, "../static");
var WELL_KNOWN_PATH = path.join(STATIC_PATH, ".well-known");
var CHALLENGE_PATH  = path.join(WELL_KNOWN_PATH, "acme-challenge");

module.exports = {
	CERT_PATH:       CERT_PATH,
	STATIC_PATH:     STATIC_PATH,
	CHALLENGE_PATH:  CHALLENGE_PATH,
	EXPIRE_TIME:     6.912e+9
};

// Ensure cert path exists.
try { fs.accessSync(CERT_PATH); }
catch (_) { fs.mkdirSync(CERT_PATH); }

// Ensure static path exists.
try { fs.accessSync(STATIC_PATH); }
catch (_) { fs.mkdirSync(STATIC_PATH); }

// Ensure well known path exists.
try { fs.accessSync(WELL_KNOWN_PATH); }
catch (_) { fs.mkdirSync(WELL_KNOWN_PATH); }

// Ensure challenge path exists.
try { fs.accessSync(CHALLENGE_PATH); }
catch (_) { fs.mkdirSync(CHALLENGE_PATH); }
