#!/usr/bin/env node
// Optional voice service: hold-to-talk page + local Whisper + relay character.
// Settings come from the `voice` section of the instance's crew.json; see docs/VOICE.md.
import http from 'node:http'
import https from 'node:https'
import { readFileSync, existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { connectBot } from '../bot/connect.js'
import { createRelay } from './relay.js'
import { createTranscriber } from './transcribe.js'
import { createVoiceHandler } from './server.js'
import { DEFAULT_RELAY } from './format.js'
import { dualSchemeServer } from './listen.js'
import { homePaths } from '../home.js'

const paths = homePaths()
const crew = JSON.parse(readFileSync(paths.crewFile, 'utf8'))
const voice = crew.voice ?? {}
const port = Number(process.env.VOICE_PORT ?? voice.port ?? 8443)
// Certificate and saved orders live in the instance ($AUGI_HOME/voice).
const certDir = paths.voiceDir
const useHttps = process.env.VOICE_HTTPS !== '0' && existsSync(path.join(certDir, 'key.pem'))
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`)

const relay = createRelay({
  log,
  connect: () => connectBot({
    host: crew.connection.host,
    port: crew.connection.port,
    auth: crew.connection.auth,
    version: crew.connection.version,
    username: voice.relay ?? DEFAULT_RELAY
  })
})
const handler = createVoiceHandler({
  transcribe: createTranscriber(),
  relay,
  targets: crew.workers.map(w => ({ name: w.username, role: w.role })),
  players: voice.players ?? [],
  // Saved orders (the page's "Save recordings" toggle) stay in the instance directory.
  recordDir: path.join(certDir, 'recordings'),
  log
})
const server = useHttps
  ? dualSchemeServer(https.createServer({ key: readFileSync(path.join(certDir, 'key.pem')), cert: readFileSync(path.join(certDir, 'cert.pem')) }, handler), { onClient: a => log(`device connected from ${a}`) })
  : http.createServer(handler)

server.listen(port, '0.0.0.0', () => {
  const scheme = useHttps ? 'https' : 'http'
  log(`voice page: ${scheme}://localhost:${port}`)
  for (const i of Object.values(networkInterfaces()).flat()) {
    if (i?.family === 'IPv4' && !i.internal) log(`  on the home network: ${scheme}://${i.address}:${port}`)
  }
  if (!useHttps) log(`no certificate in ${certDir}: tablets cannot use the microphone over plain http`)
})
relay.start()
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { relay.stop(); server.close(); process.exit(0) })
