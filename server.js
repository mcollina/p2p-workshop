'use strict'

var fs = require('fs')
var net = require('net')
var pump = require('pump')
var DC = require('discovery-channel')
var crypto = require('crypto')
var channel = DC({ dht: false }) // when testing, disable dht `{dht: false}`

var buffer = fs.readFileSync(__filename)
var hash = crypto.createHash('sha256')
hash.update(buffer)
hash = hash.digest().toString('hex')

var server = net.createServer(function (socket) {
  socket.end(buffer)
})

server.listen(0, function () {
  console.log('Server is listening on port', server.address().port)

  console.log('Serving', hash)
  channel.join(hash, server.address().port)
})
