var path = require('path')

require('tape')
  .createStream()
  .pipe(require('tap-spec')())
  .pipe(process.stdout)

process.argv.slice(2).forEach(function (file) {
  require(path.resolve(__dirname, file))
})
