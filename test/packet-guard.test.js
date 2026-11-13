import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { installPacketGuard } from '../runtime/bot/packet-guard.js'

const deserializer = () => ({
  parsePacketBuffer (buf) {
    if (buf[0] === 0x85) throw new Error('Read error for undefined : array size is abnormally large')
    return { data: { name: 'ok', params: {} }, metadata: { size: buf.length } }
  }
})

test('unparseable play packets are skipped instead of dropping the connection', () => {
  const client = Object.assign(new EventEmitter(), { state: 'login', deserializer: deserializer() })
  const warnings = []
  const report = installPacketGuard(client, m => warnings.push(m))
  // A new deserializer per protocol state; the guard patches each one.
  client.state = 'play'; client.deserializer = deserializer(); client.emit('state', 'play')
  assert.equal(client.deserializer.parsePacketBuffer(Buffer.from([0x10, 1])).data.name, 'ok')
  const skipped = client.deserializer.parsePacketBuffer(Buffer.from([0x85, 0x01, 2, 3]))
  assert.equal(skipped.data.name, 'augi_skipped_packet')
  assert.equal(skipped.metadata.size, 4)
  assert.deepEqual(report.skipped.map(s => [s.id, s.size]), [[0x85, 4]])
  assert.match(warnings[0], /0x85/)
})

test('parse errors outside play state still fail', () => {
  const client = Object.assign(new EventEmitter(), { state: 'login', deserializer: deserializer() })
  installPacketGuard(client, () => {})
  assert.throws(() => client.deserializer.parsePacketBuffer(Buffer.from([0x85])), /abnormally large/)
})
