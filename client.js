'use strict'

var fs = require('fs')
var net = require('net')
var pump = require('pump')
var DC = require('discovery-channel')
var channel = DC({ dht: false }) // when testing, disable dht `{dht: false}`
var Hash = require('stream-hash')

var id = process.argv[2] || 'matteo!!'

channel.join(id)

channel.once('peer', function (_id, peer, type) {
  console.log('peer found', peer)
  var stream = net.connect(peer.port, peer.host)
  var hash = Hash({ algorithm: 'sha256', encoding: 'hex' }, function (hash) {
    console.log('computed', hash)
    if (hash !== id) {
      console.log('HASH DOES NOT MATCH')
    } else {
      console.log('ok')
    }
  })
  pump(stream, hash, fs.createWriteStream('file-' + Date.now()), function (err) {
    if (err) {
      throw err
    }

    channel.destroy()
  })
})
