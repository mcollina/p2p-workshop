'use strict'

var fs = require('fs')
var net = require('net')
var DC = require('discovery-channel')
var msgpack = require('msgpack5-stream')
var fsChunkStore = require('fs-chunk-store')
var crypto = require('crypto')

var id = process.argv[2]
var dest = process.argv[3] || 'file-' + Date.now()

if (!id) {
  console.log('Usage: node client.js id [dest]')
  process.exit(1)
}

var channel = DC({dht: false}) // set true to work over the internet
var finished = false
channel.join(id)

channel.once('peer', function (peerId, peer, type) {
  console.log('New peer %s:%s found via %s', peer.host, peer.port, type)

  var socket = net.connect(peer.port, peer.host)

  // Wrap our TCP socket with a msgpack5 protocol wrapper
  var protocol = msgpack(socket)

  protocol.write({
    type: 'file'
  })

  protocol.once('data', function (msg) {
    var hashes = msg.hashes
    var size = msg.size
    var chunkSize = msg.chunkSize

    if (!hashes || !size) {
      throw new Error('no hashes or no size')
    }

    var file = fsChunkStore(chunkSize, {path: dest, length: size})
    var received = []
    var totalChunks = 0

    for (var i = 0; i < hashes.length; i++) {
      protocol.write({
        type: 'request',
        index: i
      })
    }

    protocol.on('data', function (msg) {
      var index = msg.index
      console.log('received', index, totalChunks++)
      var hash = crypto.createHash('sha256')
        .update(msg.data)
        .digest()
        .toString('hex')

      if (hash !== hashes[index]) {
        console.log('HASH DOES NOT MATCH')
        process.exit(0)
      }

      received[index] = hash

      file.put(index, msg.data, function (err) {
        if (err) {
          throw err
        }

        if (!finished && totalChunks === hashes.length) {
          finished = true

          for (var i = 0; i < hashes.length; i++) {
            if (hashes[i] !== received[i]) {
              throw new Error('something murky is going on ' + i)
            }

            protocol.destroy()
            channel.destroy()
          }
        }
      })
    })
  })
})
