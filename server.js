'use strict'

var fs = require('fs')
var net = require('net')
var pump = require('pump')
var DC = require('discovery-channel')
var crypto = require('crypto')
var channel = DC({ dht: true }) // when testing, disable dht `{dht: false}`

var buffer = fs.readFileSync(process.argv[2] || __filename)
var hash = crypto.createHash('sha256')
hash.update(buffer)
hash = hash.digest().toString('hex')

var server = net.createServer(function (socket) {
  socket.end(buffer)
  socket.on('error', function (err) {
    console.log(err)
  })
})

server.listen(0, function () {
  console.log('Server is listening on port', server.address().port)

  console.log('Serving', hash)
  channel.join(hash, server.address().port)
})
