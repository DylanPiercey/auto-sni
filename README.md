[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![Join the chat at https://gitter.im/DylanPiercey/auto-sni](https://badges.gitter.im/DylanPiercey/auto-sni.svg)](https://gitter.im/DylanPiercey/auto-sni?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Auto SNI

SSL Certificates using SNI with almost zero configuration for free with https://letsencrypt.org!

If you have any questions, throw them up on gitter.

# Installation

#### Npm
```console
npm install auto-sni
```

# Features
+ Fetch SSL certificates from letsencrypt.
+ Automatically renew certificates.
+ Forward all incoming http requests to https.

# Example

```javascript
var createServer = require("auto-sni");

var server = createServer({
  email: ..., // Emailed when certificates expire.
  agreeTos: true, // Required for letsencrypt.
  debug: true, // Add console messages and uses staging LetsEncrypt server. (Disable in production)
  domains: ["mysite.com", ["test.com", "www.test.com"]], // List of accepted domain names. (You can use nested arrays to register bundles with LE).
  dir: "~/letsencrypt/etc", // Directory for storing certificates. Defaults to "~/letsencrypt/etc" if not present.
  ports: {
    http: 80, // Optionally override the default http port.
    https: 443 // // Optionally override the default https port.
  }
});

// Server is a "https.createServer" instance.
server.once("listening", ()=> {
  console.log("We are ready to go.");
});

```

### Usage with express.
```js
var createServer = require("auto-sni");
var express      = require("express");
var app          = express();

app.get("/test", ...);

createServer({ email: ..., domains: ..., agreeTos: true }, app);
```

### Usage with koa.
```js
var createServer = require("auto-sni");
var koa          = require("koa");
var app          = koa();

app.use(...);

createServer({ email: ..., domains: ..., agreeTos: true }, app.callback());
```

### Usage with rill.
```js
var createServer = require("auto-sni");
var rill         = require("rill");
var app          = rill();

app.get("/test", ...);

createServer({ email: ..., domains: ..., agreeTos: true }, app.handler());
```

### Usage with hapi.
```js
// Untested (Let me know in gitter if this doesn't work.)
var createServer = require("auto-sni");
var hapi         = require("hapi");
var server       = new hapi.Server();
var secureServer = createServer({ email: ..., domains: ..., agreeTos: true });

server.connection({ listener: secureServer, autoListen: false, tls: true });
```

### Usage with restify.
```js
// Untested (Let me know in gitter if this doesn't work.)
var createServer = require("auto-sni");
var restify      = require("restify");
var app          = restify.createServer({ name: 'myapp', version: '1.0.0' });

app.get("/test", ...);

createServer({ email: ..., domains: ..., agreeTos: true }, app.server);
```

# Dynamic Domains
You can also specify an async function to approve domains like so:

```js
createServer({
  ...,
  domains: (options, cert, cb) => {
    setTimeout(() => cb({ options, cert }), 1000)
  }
})
```

# Root Access
AutoSNI requires access to low level ports 80 (http) and 443 (https) to operate by default.
These ports are typically restricted by the operating system.

In production (on linux servers) you can use the following command to give Node access to these ports.

```console
sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``
```

For development it's best to set the "ports" option manually to something like:
```js
{
  ports: {
    http: 3001,
    https: 3002
  }
}

// Access server on localhost:3002
```

# Rate Limits
Currently LetsEncrypt imposes some rate limits on certificate creation.
[Click here for the current rate limits.](https://community.letsencrypt.org/t/rate-limits-for-lets-encrypt/6769)

### Contributions

Please use `npm test` for tests and feel free to create a PR!
