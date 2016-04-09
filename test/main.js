var test = require('tape')
var ngrok = require('ngrok')
var hostile = require('hostile')
var request = require('supertest')
var createServer = require('../')
var TEST_CONFIG = {
  debug: true,
  email: 'autosni.github@gmail.com',
  agreeTos: true,
  // Explicitly use new ports.
  ports: { http: undefined, https: undefined }
}

test('required fields', function (t) {
  t.plan(4)
  t.throws(createServer.bind(null), TypeError, 'options are required')
  t.throws(createServer.bind(null, { agreeTos: true }), /Email is required/, 'email is required')
  t.throws(createServer.bind(null, { email: 'a@b.com' }), /Must agree to LE TOS/, 'tos is required')

  createServer({
    email: 'a@b.com',
    agreeTos: true,
    // We only use ports here to avoid EACCES.
    ports: { http: 3000, https: 3001 }
  })
    .once('error', t.fail)
    .once('listening', function () {
      this.close()
      t.pass('server should start')
    })
})

test('register certificate fallback to unsigned', function (t) {
  t.plan(4)

  // Handler argument.
  createServer(TEST_CONFIG, helloWorld)
    .once('error', t.fail)
    .once('listening', function () {
      request(this)
        .get('/')
        .set('Host', 'test.com')
        .end(function (err, res) {
          t.ok(err, 'should have an error')
          t.equal(err.message, 'self signed certificate', 'should be a self signed certificate')
          this.close()
        }.bind(this))
    })

  // Request event.
  createServer(TEST_CONFIG)
    .on('request', helloWorld)
    .once('error', t.fail)
    .once('listening', function () {
      request(this)
        .get('/')
        .set('Host', 'test.com')
        .end(function (err, res) {
          t.ok(err, 'should have an error')
          t.equal(err.message, 'self signed certificate', 'should be a self signed certificate')
          this.close()
        }.bind(this))
    })
})

/** These tests are a WIP currently ngrok requires Pro to use custom TLS so an alternative is needed */
test('register certificate with letsencrypt', function (t) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  t.plan(1)
  createServer(TEST_CONFIG, helloWorld)
    .once('error', t.fail)
    .once('listening', function () {
      var server = this
      ngrok.connect({ port: server.http.address().port }, function (err, url) {
        if (err) return t.fail(err)
        var host = url.replace('https://', '')

        hostile.set('127.0.0.1', host, function (err) {
          if (err) return t.fail(err)
          // TODO: Bind host in /etc/hosts and request it locally then remove it.
          request(url + ':' + server.address().port)
            .get('/')
            .end(function (err, res) {
              if (err) return t.fail(err)
              t.equal(res.text, 'Hello World\n', 'should respond to https request')
              ngrok.disconnect(url)
              server.close()
              hostile.remove('127.0.0.1', host)
            })
        })
      })
    })
})

/**
 * Generic hello world server responder.
 */
function helloWorld (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello World\n')
}
