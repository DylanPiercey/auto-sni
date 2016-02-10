var test = require('tape')
// var ngrok = require('ngrok')
var request = require('supertest')
var createServer = require('../')
var TEST_CONFIG = {
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
  t.plan(2)
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
})

/** These tests are a WIP currently ngrok requires Pro to use custom TLS so an alternative is needed */
// test('register certificate with letsencrypt', function (t) {
//   t.plan(2)
//   createServer(TEST_CONFIG, helloWorld)
//     .once('error', t.fail)
//     .once('listening', function () {
//       ngrok.connect({ port: this.address().port, proto: 'tls' }, function (err, url) {
//         if (err) return t.fail(err)
//         request(url)
//           .get('/')
//           .end(function (err, res) {
//             ngrok.disconnect(url)
//             server.close()
//           })
//       })
//     })
// })

/**
 * Generic hello world server responder.
 */
function helloWorld (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello World\n')
}
