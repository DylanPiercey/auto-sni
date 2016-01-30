# Auto SNI
SSL Certificates using SNI with zero configuration for free with https://letsencrypt.org!
If creating a certificate fails it will fall back to a simple self signed certificate.

# Installation

#### Npm
```console
npm install auto-sni
```

# THIS IS UNDER DEVELOPMENT AND IS NOT COMPLETED.

# Example

```javascript
var createServer = require("auto-sni");

createServer({
	email: ..., // Emailed when certificates expire.
	agreeTos: true, // Required for letsencrypt.
	debug: true, // Add console messages.
	ports: {
		http: 80, // Optionally override the default http port.
		https: 443 // // Optionally override the default https port.
	}
}, function (req, res) {
	// Handle request...
}).then(function () {
	// Returns a promise that will throw if the server cannot be initialized.
})
```

### Contributions

Please feel free to create a PR!
