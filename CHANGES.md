2.3.2 2017-10-05
==================
  * Add `dir` option to readme example.

2.3.0, 2.3.1 2017-07-22
==================
  * Add ability to approve domains with a function.

2.2.1 2017-06-11
==================
  * Update readme regarding root access to privileged ports.

2.2.0 2017-06-05
==================
  * Flatten domains option for compatibility with @1.x

2.1.1 2017-04-13
==================
  * Internal implementation switched to use greenlock-express.
  * No longer falls back to self signed when unable to communicate with letsencrypt.
  * Removed ability to disable https redirection (should just use vanilla http server).
  * Simplified api.

1.5.2 2016-09-21
==================
  * Fix travis ci.

1.5.1 2016-08-26
==================
  * Update letsencrypt rate limit link in docs.
  * Update bluebird.

1.5.0 2016-08-26
==================
  * Fix mkdirp issue and lock down `letsencrypt@1.5.1` until `auto-sni@2.0`.
  * Fixes issue when using `letsencrypt@1.5.8`.

1.3.0 2016-08-01
==================
  * Add ability to change redirect code when `forceSSL` is enabled.

1.2.1 2016-05-16
==================
  * Fix issue with self signed fallback certificate.

1.1.3 2016-05-16
==================
  * Update dependencies (fixes issue with node 6).

1.1.1 2016-04-23 (Will reset renew certificates)
==================
  * Clears certificate when switching between debug modes.
  * Clears certificate when bundle changes (previously bundles were tied to the first domain).
  * Attempt to fix some issues with restify.

1.0.0 / 2016-04-17
==================
  * Remove bundle option.
  * No longer fuzzy match domains with `path-to-regexp`.
  * Allow for nested arrays in `domains` for bundled certificates.
