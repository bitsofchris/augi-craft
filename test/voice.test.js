import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { formatVoiceChat, parseVoiceChat } from '../runtime/voice/format.js'
import { cleanTranscript, commandFor, createTranscriber } from '../runtime/voice/transcribe.js'
import { createVoiceHandler } from '../runtime/voice/server.js'
import { createRelay } from '../runtime/voice/relay.js'
import { BotSession } from '../runtime/bot/session.js'

test('voice lines round-trip and only count from the relay', () => {
  const line = formatVoiceChat('.Kid1', '  get me   diamonds ', 'AugiDiamond')
  assert.equal(line, '[voice] .Kid1: AugiDiamond, get me diamonds')
  assert.deepEqual(parseVoiceChat('AugiEars', line), { username: '.Kid1', message: 'AugiDiamond, get me diamonds' })
  assert.equal(parseVoiceChat('augiears', line, 'AugiEars').username, '.Kid1')
  assert.equal(parseVoiceChat('SomeKid', line), null, 'anyone else typing the format is ordinary chat')
  assert.equal(parseVoiceChat('AugiEars', 'hello'), null)
})

test('BotSession records relayed orders as chat from the speaking player', () => {
  const bot = new EventEmitter()
  bot.username = 'AugiDiamond'
  const session = new BotSession({ bot, voiceRelay: 'AugiEars' })
  bot.emit('chat', 'AugiEars', '[voice] .Kid1: AugiDiamond, get me diamonds')
  bot.emit('chat', 'Operator', 'hi')
  const chat = session.drainInbox().filter(e => e.type === 'chat')
  assert.equal(chat[0].username, '.Kid1')
  assert.equal(chat[0].message, 'AugiDiamond, get me diamonds')
  assert.equal(chat[0].via, 'voice')
  assert.equal(chat[1].username, 'Operator')
  assert.equal(chat[1].via, undefined)
})

test('transcriber substitutes the file and cleans tool output', async () => {
  assert.deepEqual(commandFor('mw transcribe --model m {file}', '/t/a.wav'), ['mw', 'transcribe', '--model', 'm', '/t/a.wav'])
  assert.deepEqual(commandFor('whisper-cli -f', '/t/a.wav'), ['whisper-cli', '-f', '/t/a.wav'])
  assert.equal(cleanTranscript('Transcribing a.wav...\nAji Diamond,\nget me diamonds [BLANK_AUDIO]\n'), 'Aji Diamond, get me diamonds')
  let argv
  const transcribe = createTranscriber({ template: 'stt {file}', run: (cmd, args, opts, cb) => { argv = [cmd, ...args]; cb(null, 'hello there\n', '') } })
  assert.equal(await transcribe('/t/x.wav'), 'hello there')
  assert.deepEqual(argv, ['stt', '/t/x.wav'])
  const failing = createTranscriber({ run: (cmd, args, opts, cb) => cb(new Error('boom'), '', 'model missing') })
  await assert.rejects(failing('/t/x.wav'), /model missing/)
})

function wav (bytes = 3200) {
  const b = Buffer.alloc(44 + bytes)
  b.write('RIFF', 0, 'ascii'); b.write('WAVE', 8, 'ascii')
  return b
}

async function withServer (opts, fn) {
  const relay = Object.assign(new EventEmitter(), { said: [], say (line) { this.said.push(line) }, online: n => n === 'AugiGuard' })
  const handler = createVoiceHandler({ relay, targets: [{ name: 'AugiGuard', role: 'bodyguard' }, { name: 'AugiDiamond', role: 'diamond' }], players: ['.Kid1'], transcribe: async () => 'come here', ...opts })
  const server = http.createServer(handler).listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try { await fn({ base, relay, handler }) } finally { server.closeAllConnections(); server.close() }
}

test('voice server posts a transcribed order for the chosen bot', async () => {
  await withServer({}, async ({ base, relay }) => {
    const cfg = await (await fetch(`${base}/api/config`)).json()
    assert.deepEqual(cfg.targets.map(t => [t.name, t.online]), [['AugiGuard', true], ['AugiDiamond', false]])
    const out = await (await fetch(`${base}/api/talk?target=AugiGuard`, { method: 'POST', body: wav() })).json()
    assert.equal(out.ok, true)
    assert.deepEqual(relay.said, ['[voice] .Kid1: AugiGuard, come here'])
  })
})

test('voice server rejects bad input and empty transcripts without posting', async () => {
  await withServer({ transcribe: async () => '', maxBytes: 10_000 }, async ({ base, relay }) => {
    const post = (q, body) => fetch(`${base}/api/talk?${q}`, { method: 'POST', body })
    assert.equal((await post('target=AugiWood', wav())).status, 400)
    assert.equal((await post('target=AugiGuard&player=Mallory', wav())).status, 400)
    assert.equal((await post('target=AugiGuard', Buffer.from('not audio at all, really not audio'))).status, 400)
    assert.equal((await post('target=AugiGuard', wav(20_000))).status, 413)
    const quiet = await (await post('target=AugiGuard', wav())).json()
    assert.equal(quiet.ok, false)
    assert.match(quiet.error, /did not hear/)
    assert.deepEqual(relay.said, [])
  })
})

test('voice server keeps audio and transcript only for orders sent with save=1', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-rec-'))
  const now = () => new Date(2026, 9, 18, 10, 5, 9)
  await withServer({ recordDir: dir, now }, async ({ base }) => {
    assert.equal((await (await fetch(`${base}/api/config`)).json()).canSave, true)
    const plain = await (await fetch(`${base}/api/talk?target=AugiGuard`, { method: 'POST', body: wav() })).json()
    assert.equal(plain.saved, undefined)
    assert.deepEqual(fs.readdirSync(dir), [])
    const kept = await (await fetch(`${base}/api/talk?target=AugiGuard&save=1`, { method: 'POST', body: wav() })).json()
    assert.equal(kept.saved, path.join('2026-10-18', '100509-Kid1-to-AugiGuard.wav'))
    assert.deepEqual(fs.readFileSync(path.join(dir, kept.saved)), wav())
    const index = fs.readFileSync(path.join(dir, 'index.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l))
    assert.deepEqual(index.map(e => [e.player, e.target, e.text, e.file]), [['.Kid1', 'AugiGuard', 'come here', kept.saved]])
  })
  await withServer({}, async ({ base }) => {
    assert.equal((await (await fetch(`${base}/api/config`)).json()).canSave, false)
    assert.equal((await (await fetch(`${base}/api/talk?target=AugiGuard&save=1`, { method: 'POST', body: wav() })).json()).saved, undefined)
  })
  fs.rmSync(dir, { recursive: true, force: true })
})

test('voice server streams replies from bots only', async () => {
  await withServer({}, async ({ base, relay, handler }) => {
    const res = await fetch(`${base}/api/events`)
    const reader = res.body.getReader()
    await reader.read() // ": connected"
    while (handler.clients.size === 0) await new Promise(resolve => setImmediate(resolve))
    relay.emit('chat', { username: 'Operator', message: 'not a bot' })
    relay.emit('chat', { username: 'AugiGuard', message: 'on my way' })
    const { value } = await reader.read()
    assert.deepEqual(JSON.parse(new TextDecoder().decode(value).replace(/^data: /, '')), { type: 'reply', username: 'AugiGuard', message: 'on my way' })
    await reader.cancel()
  })
})

test('relay refuses commands and reports when it is not connected', async () => {
  const bot = Object.assign(new EventEmitter(), { username: 'AugiEars', players: { AugiGuard: {} }, sent: [], chat (m) { this.sent.push(m) } })
  const relay = createRelay({ connect: async () => bot })
  assert.throws(() => relay.say('[voice] x: hi'), /not in the game/)
  await relay.start()
  relay.say('[voice] x: hi')
  assert.throws(() => relay.say('/op me'), /not allowed/)
  assert.deepEqual(bot.sent, ['[voice] x: hi'])
  assert.equal(relay.online('AugiGuard'), true)
  const heard = []
  relay.on('chat', e => heard.push(e))
  bot.emit('chat', 'AugiEars', 'echo')
  bot.emit('chat', 'AugiGuard', 'hi kid')
  assert.deepEqual(heard, [{ username: 'AugiGuard', message: 'hi kid' }])
  relay.stop()
})

test('one port serves https and redirects plain http to it', async () => {
  const https = (await import('node:https')).default
  const secureHits = []
  const fakeSecure = { emit: (event, socket) => { secureHits.push(event); socket.end() } }
  const clients = []
  const server = (await import('../runtime/voice/listen.js')).dualSchemeServer(fakeSecure, { onClient: a => clients.push(a) }).listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const port = server.address().port
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/config`, { redirect: 'manual' })
    assert.equal(res.status, 301)
    assert.equal(res.headers.get('location'), `https://127.0.0.1:${port}/api/config`)
    await new Promise(resolve => https.get(`https://127.0.0.1:${port}/`, { rejectUnauthorized: false }).on('error', resolve).on('close', resolve))
    assert.deepEqual(secureHits, ['connection'], 'the TLS handshake went to the https server')
    assert.deepEqual(clients, ['127.0.0.1'], 'each client address is reported once')
  } finally { server.close() }
})
