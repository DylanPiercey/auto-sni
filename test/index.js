var path = require('path')
var tape = require('tape')

tape
  .createStream()
  .pipe(require('tap-spec')())
  .pipe(process.stdout)

tape.onFinish(process.exit)

process.argv.slice(2).forEach(function (file) {
  require(path.resolve(__dirname, file))
})
