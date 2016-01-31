# Auto SNI
SSL Certificates using SNI with almost zero configuration for free with https://letsencrypt.org!

This module has yet to be thoroughly tested but feel free to give it a shot!

# Installation

#### Npm
```console
npm install auto-sni
```

# Features
+ Fetch SSL certificates from letsencrypt.
+ Automatically renew certificates.
+ If creating a certificate fails it will fall back to a simple self signed certificate.
+ Forward all incomming http requests to https.

# Example

```javascript
var createServer = require("auto-sni");

createServer({
	email: ..., // Emailed when certificates expire.
	agreeTos: true, // Required for letsencrypt.
	debug: true, // Add console messages.
	domains: ["test.com", "(dev|staging|production).test.com"], // Optional list of allowed domains (uses pathtoregexp)
	ports: {
		http: 80, // Optionally override the default http port.
		https: 443 // // Optionally override the default https port.
	}
}, function (req, res) {
	// Handle request...
}).then(function () {
	// Returns a promise that resolves when both the http and https server are listening.
}).catch(function (e) {
	// Errors if there is an issue starting either server.
})
```

### Usage with express.
```js
var createServer = require("auto-sni");
var express      = require("express");
var app          = express();

app.get("/test", ...);

createServer({ email: ..., agreeTos: true }, app);
```

### Usage with koa.
```js
var createServer = require("auto-sni");
var koa          = require("koa");
var app          = koa();

app.use(...);

createServer({ email: ..., agreeTos: true }, app.callback());
```

### Usage with rill.
```js
var createServer = require("auto-sni");
var koa          = require("rill");
var app          = rill();

app.use(...);

createServer({ email: ..., agreeTos: true }, app.handler());
```

### Contributions

Please feel free to create a PR!
