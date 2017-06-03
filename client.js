'use strict'

var fs = require('fs')
var net = require('net')
var DC = require('discovery-channel')
var msgpack = require('msgpack5-stream')
var fsChunkStore = require('fs-chunk-store')
var crypto = require('crypto')
var eos = require('end-of-stream')

var id = process.argv[2]
var dest = process.argv[3] || 'file-' + Date.now()

if (!id) {
  console.log('Usage: node client.js id [dest]')
  process.exit(1)
}

var channel = DC({dht: false}) // set true to work over the internet
var file = null
var finished = false
var received = []
var totalChunks = 0
var queue = []
var hashes = null
var clients = new Set()
channel.join(id)

channel.on('peer', function (peerId, peer, type) {
  console.log('New peer %s:%s found via %s', peer.host, peer.port, type)

  if (finished) {
    return
  }

  var socket = net.connect(peer.port, peer.host)

  // Wrap our TCP socket with a msgpack5 protocol wrapper
  var protocol = msgpack(socket)

  clients.add(protocol)

  eos(protocol, function (err) {
    if (err && !finished) {
      console.log(err)
    }

    clients.delete(protocol)
  })

  protocol.write({
    type: 'file'
  })

  protocol.once('data', function (msg) {
    if (!file) {
      hashes = msg.hashes
      var size = msg.size
      var chunkSize = msg.chunkSize

      if (!hashes || !size) {
        throw new Error('no hashes or no size')
      }

      file = fsChunkStore(chunkSize, {path: dest, length: size})

      for (var i = 0; i < hashes.length; i++) {
        queue.push(i)
      }
    }

    schedule(protocol)
    protocol.on('data', onChunk)
  })
})

function schedule (protocol) {
  protocol.chunks = []
  eos(protocol, function (err) {
    if (err) {
      console.log(err)
    }

    protocol.chunks.forEach((c) => queue.push(c))
  })

  for (var i = 0; i < 10; i++) {
    downloadChunk(protocol)
  }
}

function downloadChunk (protocol) {
  var chunk = queue.shift()
  if (chunk === undefined) {
    return
  }

  protocol.write({
    type: 'request',
    index: chunk
  })
}

function onChunk (msg) {
  var index = msg.index
  console.log('received', index, totalChunks++, hashes.length)
  var hash = crypto.createHash('sha256')
    .update(msg.data)
    .digest()
    .toString('hex')

  if (hash !== hashes[index]) {
    console.log('HASH DOES NOT MATCH')
    process.exit(0)
  }

  downloadChunk(this)
  received[index] = hash

  file.put(index, msg.data, function (err) {
    if (err) {
      throw err
    }

    if (!finished && totalChunks >= hashes.length) {
      finished = true

      for (var i = 0; i < hashes.length; i++) {
        if (hashes[i] !== received[i]) {
          throw new Error('something murky is going on ' + i)
        }

        clients.forEach((c) => c.end())
        channel.destroy()
      }
    }
  })
}
