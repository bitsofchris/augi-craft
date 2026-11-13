import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { EventEmitter } from 'node:events'
import mc from 'minecraft-protocol'
import { Vec3 } from 'vec3'
import { buildZip, readZip } from '../runtime/recording/zip.js'
import { ReplayRecorder, recordBot, decodeRecords, encodeRecord, angleByte, FILE_FORMAT_VERSION } from '../runtime/recording/replay-recorder.js'
import { recordingDirFromEnv } from '../runtime/bot/connect.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'augi-rec-'))
const play = mc.createDeserializer({ state: 'play', isServer: false, version: '26.3' })
const loginSuccess = () => mc.createSerializer({ state: 'login', isServer: true, version: '26.3' })
  .createPacketBuffer({ name: 'success', params: { uuid: '00000000-0000-0000-0000-0000000000aa', username: 'Agent1', properties: [], sessionId: '00000000-0000-0000-0000-000000000000' } })

test('zip entries round-trip and records keep their time and bytes', () => {
  const zip = readZip(buildZip([{ name: 'a.txt', data: Buffer.from('hello') }, { name: 'b.bin', data: Buffer.alloc(5000, 7) }]))
  assert.equal(zip['a.txt'].toString(), 'hello')
  assert.equal(zip['b.bin'].length, 5000)
  const recs = decodeRecords(Buffer.concat([encodeRecord(0, Buffer.from([1, 2])), encodeRecord(1500, Buffer.from([3]))]))
  assert.deepEqual(recs.map(r => [r.ms, [...r.packet]]), [[0, [1, 2]], [1500, [3]]])
  assert.equal(angleByte(90), 64)
  assert.equal(angleByte(270), -64)
})

test('the recording starts at login success and the replay file follows the ReplayMod format', () => {
  const dir = tmp()
  let now = 1_000_000
  const r = new ReplayRecorder({ dir, name: 'Agent1', version: '26.3', now: () => now })
  r.capture('login', Buffer.from([0x03, 0x00]), 'compress') // before login success: not recorded
  r.capture('login', loginSuccess(), 'success')
  now += 250
  r.capture('configuration', Buffer.from([0x03]), 'finish_configuration')
  now += 750
  r.capture('play', Buffer.from([0x00]), 'bundle_delimiter')
  r.addMarker('Kid1: build a cabin', { x: 1, y: 64, z: 2 })
  const file = r.close()
  assert.match(path.basename(file), /-Agent1\.mcpr$/)
  const zip = readZip(fs.readFileSync(file))
  const meta = JSON.parse(zip['metaData.json'])
  assert.equal(meta.fileFormat, 'MCPR')
  assert.equal(meta.fileFormatVersion, FILE_FORMAT_VERSION)
  assert.equal(meta.protocol, 777)
  assert.equal(meta.mcversion, '26.3')
  assert.equal(meta.duration, 1000)
  assert.equal(meta.date, 1_000_000)
  const recs = decodeRecords(zip['recording.tmcpr'])
  assert.deepEqual(recs.map(x => x.ms), [0, 250, 1000])
  assert.equal(recs[0].packet[0], 0x02, 'first record is login success')
  assert.equal(zip['recording.tmcpr.crc32'].toString(), String(zlib.crc32(zip['recording.tmcpr'])))
  const markers = JSON.parse(zip['markers.json'])
  assert.deepEqual(markers[0], { realTimestamp: 1000, value: { name: 'Kid1: build a cabin', position: { x: 1, y: 64, z: 2, yaw: 0, pitch: 0, roll: 0 } } })
  assert.match(fs.readFileSync(file.replace(/\.mcpr$/, '.markers.txt'), 'utf8'), /0:01 {2}Kid1: build a cabin/)
  assert.ok(!fs.existsSync(file.replace(/\.mcpr$/, '.tmcpr.part')), 'temporary stream removed')
})

test('a recorded bot gets its own spawn, position and head packets, and the file closes on disconnect', () => {
  const dir = tmp()
  const client = Object.assign(new EventEmitter(), { state: 'login', uuid: '00000000-0000-0000-0000-0000000000aa' })
  const names = { 2: 'success', 3: 'finish_configuration' }
  client.deserializer = { parsePacketBuffer: buf => ({ data: { name: names[buf[0]] ?? 'other', params: {} } }) }
  const bot = Object.assign(new EventEmitter(), {
    _client: client,
    registry: require26_3(),
    entity: { id: 42, position: new Vec3(10.5, 64, -3.5), yaw: 0, pitch: 0, onGround: true }
  })
  const r = recordBot(bot, new ReplayRecorder({ dir, name: 'Agent1', version: '26.3' }))
  client.deserializer.parsePacketBuffer(loginSuccess())
  client.state = 'play'
  bot.emit('login')
  bot.emit('spawn')
  bot.entity.position = new Vec3(12.5, 64, -3.5)
  bot.emit('physicsTick')
  bot.emit('end')
  const zip = readZip(fs.readFileSync(r.file))
  assert.equal(JSON.parse(zip['metaData.json']).selfId, 42)
  const own = decodeRecords(zip['recording.tmcpr']).slice(1).map(x => play.parsePacketBuffer(x.packet).data)
  assert.equal(own[0].name, 'spawn_entity')
  assert.equal(own[0].params.entityId, 42)
  assert.equal(own[0].params.type, bot.registry.entitiesByName.player.id)
  const moves = own.filter(p => p.name === 'sync_entity_position')
  assert.deepEqual(moves.at(-1).params.positionPath, { x: 12.5, y: 64, z: -3.5 })
  assert.ok(own.some(p => p.name === 'entity_head_rotation'))
})

test('recording is off unless AUGI_RECORD is set', () => {
  assert.equal(recordingDirFromEnv({}), null)
  assert.equal(recordingDirFromEnv({ AUGI_RECORD: '1', AUGI_RECORD_DIR: '/x/rec' }), '/x/rec')
  assert.match(recordingDirFromEnv({ AUGI_RECORD: 'true' }), /recordings$/)
})

function require26_3 () {
  return { entitiesByName: { player: { id: 159 } } }
}

test('orders, tasks and mark_moment become replay markers; mark_moment says when not recording', async () => {
  const { FakeBot } = await import('./helpers/fake-bot.js')
  const { createAugi } = await import('../runtime/mcp/augi.js')
  const kb = tmp()
  fs.cpSync(path.join(import.meta.dirname, '..', 'knowledge', 'seeds'), path.join(kb, 'seeds'), { recursive: true })
  fs.mkdirSync(path.join(kb, 'core'), { recursive: true })
  const bot = new FakeBot()
  const a = createAugi({ knowledgeDir: kb, bot, config: { packs: ['basic'] }, world: 'rec-test' })
  assert.equal((await a.tool('mark_moment').run({ name: 'nothing to mark' })).ok, false)
  const r = new ReplayRecorder({ dir: tmp(), name: 'Augi', version: '26.3' })
  r.capture('login', loginSuccess(), 'success')
  bot.augiRecorder = r
  bot.emit('chat', '.Kid1', 'Augi, build a cabin')
  bot.emit('chat', 'Agent2', 'Hello! I am your agent, ready for orders.') // crew chatter: no marker
  await a.tool('set_task').run({ task: 'Kid1 wants a cabin by the lake' })
  assert.deepEqual(await a.tool('mark_moment').run({ name: 'roof finished' }), { ok: true, marked: 'roof finished' })
  assert.deepEqual(r.markers.map(m => m.value.name), ['.Kid1: Augi, build a cabin', 'task: Kid1 wants a cabin by the lake', 'roof finished'])
  r.close()
})

test('a recorder error stops recording but never breaks the bot connection', () => {
  const dir = tmp()
  const client = Object.assign(new EventEmitter(), { state: 'play' })
  client.deserializer = { parsePacketBuffer: () => ({ data: { name: 'other', params: {} } }) }
  const bot = Object.assign(new EventEmitter(), { _client: client, registry: { entitiesByName: { player: { id: 159 } } }, entity: null })
  const r = recordBot(bot, new ReplayRecorder({ dir, name: 'Agent1', version: '26.3' }))
  r.capture = () => { throw new Error('disk full') }
  assert.equal(client.deserializer.parsePacketBuffer(Buffer.from([1])).data.name, 'other')
  assert.equal(r.closed, true)
})

test('replay timestamps never step backwards, even if the clock does', () => {
  let now = 5_000
  const r = new ReplayRecorder({ dir: tmp(), name: 'Agent1', version: '26.3', now: () => now })
  r.capture('login', loginSuccess(), 'success')
  now = 6_000; r.capture('play', Buffer.from([0x00]), 'bundle_delimiter')
  now = 5_500; r.capture('play', Buffer.from([0x00]), 'bundle_delimiter')
  r.close()
  const recs = decodeRecords(readZip(fs.readFileSync(r.file))['recording.tmcpr'])
  assert.deepEqual(recs.map(x => x.ms), [0, 1000, 1000])
})
