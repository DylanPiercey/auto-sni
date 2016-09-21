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
