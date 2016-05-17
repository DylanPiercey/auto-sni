var test = require('tape')
var ngrok = require('ngrok')
var hostile = require('hostile')
var request = require('supertest')
var assign = require('object-assign')
var createServer = require('../')
test.onFinish(process.exit)

var TEST_CONFIG = {
  debug: true,
  email: 'autosni.github@gmail.com',
  agreeTos: true,
  // Explicitly use new ports.
  ports: { http: null, https: null }
}

test('required fields', function (t) {
  t.plan(5)
  t.throws(createServer.bind(null), TypeError, 'options are required')
  t.throws(createServer.bind(null, { agreeTos: true }), /Email is required/, 'email is required')
  t.throws(createServer.bind(null, { email: 'a@b.com' }), /Must agree to LE TOS/, 'tos is required')
  t.throws(createServer.bind(null, { agreeTos: true, email: 'a@b.com' }), /Domains option must be a non-empty array/, 'domains is required')

  createServer({
    email: 'a@b.com',
    agreeTos: true,
    domains: ['localhost'],
    // We only use ports here to avoid EACCES.
    ports: { http: 3000, https: 3001 }
  })
    .once('error', t.fail)
    .once('listening', function () {
      this.close()
      t.pass('server should start')
    })
})

test('register certificate fallback to self-signed', function (t) {
  t.plan(4)

  // Handler argument.
  createServer(assign({ domains: ['127.0.0.1'] }, TEST_CONFIG), helloWorld)
    .once('error', t.fail)
    .once('listening', function () {
      request(this)
        .get('/')
        .end(function (err, res) {
          t.ok(err, 'should have an error')
          t.equal(err.message, 'self signed certificate', 'should be a self signed certificate')
          this.close()
        }.bind(this))
    })

  // Request event.
  createServer(assign({ domains: ['127.0.0.1'] }, TEST_CONFIG))
    .on('request', helloWorld)
    .once('error', t.fail)
    .once('listening', function () {
      request(this)
        .get('/')
        .end(function (err, res) {
          t.ok(err, 'should have an error')
          t.equal(err.message, 'self signed certificate', 'should be a self signed certificate')
          this.close()
        }.bind(this))
    })
})

/** These tests are a WIP currently ngrok requires Pro to use custom TLS so an alternative is needed */
test('register certificate with letsencrypt', function (t) {
  t.plan(1)
  var testPorts = { http: 3003, https: 3004 }
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  // Get a free subdomain.
  ngrok.connect(testPorts.http, function (err, url) {
    if (err) return t.fail(err)
    var host = url.replace('https://', '')

    // Set alias for host through local machine.
    hostile.set('127.0.0.1', host, function (err) {
      if (err) return t.fail(err)

      // Setup server
      createServer(assign({}, TEST_CONFIG, { ports: testPorts, domains: [host] }), helloWorld)
        .once('error', t.fail)
        .once('listening', function () {
          var server = this
          // Make a request to the server.
          request(url + ':' + server.address().port)
            .get('/')
            .end(function (err, res) {
              if (err) return t.fail(err)
              t.equal(res.text, 'Hello World\n', 'should respond to https request')
              ngrok.kill()
              hostile.remove('127.0.0.1', host)
              server.close()
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
