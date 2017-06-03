'use strict'

var fs = require('fs')
var net = require('net')
var DC = require('discovery-channel')
var msgpack = require('msgpack5-stream')
var crypto = require('crypto')

var id = process.argv[2]
var chunk = process.argv[3]

if (!id || !chunk) {
  console.log('Usage: node client.js [id] [chunk]')
  process.exit(1)
}

var channel = DC({dht: false}) // set true to work over the internet
channel.join(id)

channel.once('peer', function (peerId, peer, type) {
  console.log('New peer %s:%s found via %s', peer.host, peer.port, type)

  var socket = net.connect(peer.port, peer.host)

  // Wrap our TCP socket with a msgpack5 protocol wrapper
  var protocol = msgpack(socket)

  protocol.write({
    type: 'hashes'
  })

  protocol.once('data', function (msg) {
    var hashes = msg.hashes

    if (!hashes) {
      throw new Error('no hashes')
    }

    protocol.on('data', function (msg) {
      var hash = crypto.createHash('sha256')
        .update(msg.data)
        .digest()
        .toString('hex')

      if (hash !== hashes[chunk]) {
        console.log('HASH DOES NOT MATCH')
        process.exit(0)
      }

      console.log('chunk hash match')

      // For now just output the message we got from the server
      console.log(msg)
      protocol.destroy()
      channel.destroy()
    })

    console.log('Fetching chunk %d from %s...', chunk, id)

    protocol.write({
      type: 'request',
      index: chunk
    })
  })
})
