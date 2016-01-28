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
var https = require("auto-sni");

https.createServer({
	email: ..., // Emailed when certificates expire.
	agreeTos: true, // Required for letsencrypt.
	debug: true, // Add console messages.
	duplicate: true // Create new certificates before they expire.
}, function handler (req, res) {
	// Handle request...
});
```

### Contributions

Please feel free to create a PR!
