// HTTP handler for the hold-to-talk page: serves the page, takes a WAV
// upload per order, transcribes it, and posts the order through the relay.
// Bot replies stream back to the page over server-sent events.
import { readFile, writeFile, appendFile, mkdir, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { formatVoiceChat, MAX_TEXT } from './format.js'

const PAGE = new URL('./page.html', import.meta.url)
export const MAX_AUDIO_BYTES = 1_000_000 // ~30 s of 16 kHz mono 16-bit PCM

const isWav = buf => buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE'

// Local time, so saved clips line up with screen-recording timestamps.
const pad = n => String(n).padStart(2, '0')
const stamp = d => ({ day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` })
const slug = s => s.replace(/[^A-Za-z0-9_-]/g, '') || 'x'

// Keep one order's audio and transcript, only when the page asked to save.
async function saveRecording (dir, { audio, player, target, text, now = new Date() }) {
  const { day, time } = stamp(now)
  await mkdir(path.join(dir, day), { recursive: true })
  const file = path.join(day, `${time}-${slug(player)}-to-${slug(target)}.wav`)
  await writeFile(path.join(dir, file), audio)
  await appendFile(path.join(dir, 'index.jsonl'), JSON.stringify({ at: now.toISOString(), player, target, text, file }) + '\n')
  return file
}

function json (res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody (req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    // Past the limit, keep draining (and dropping) the upload so the 413 reply can be sent.
    req.on('data', c => { size += c.length; if (size <= limit) chunks.push(c) })
    req.on('end', () => size > limit ? reject(Object.assign(new Error('recording too long'), { status: 413 })) : resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * @param {object} opts
 * @param {(file: string) => Promise<string>} opts.transcribe
 * @param {{ say(line: string): void, online?(name: string): boolean, on(event: 'chat', fn: Function): void }} opts.relay
 * @param {{ name: string, role?: string }[]} opts.targets bots a player can address
 * @param {string[]} opts.players players allowed to speak; the first is the default
 * @param {string} [opts.recordDir] where orders sent with save=1 keep their audio; unset disables saving
 */
export function createVoiceHandler ({ transcribe, relay, targets, players, recordDir, maxBytes = MAX_AUDIO_BYTES, log = () => {}, now = () => new Date() }) {
  const clients = new Set()
  const send = event => { for (const res of clients) res.write(`data: ${JSON.stringify(event)}\n\n`) }
  const names = new Set(targets.map(t => t.name.toLowerCase()))
  relay.on('chat', ({ username, message }) => {
    if (names.has(username.toLowerCase())) send({ type: 'reply', username, message })
  })

  async function talk (req, res, url) {
    const target = url.searchParams.get('target') || 'everyone'
    const player = url.searchParams.get('player') || players[0]
    if (target !== 'everyone' && !names.has(target.toLowerCase())) return json(res, 400, { ok: false, error: `unknown bot ${target}` })
    if (!players.includes(player)) return json(res, 400, { ok: false, error: `unknown player ${player}` })
    const audio = await readBody(req, maxBytes)
    if (!isWav(audio)) return json(res, 400, { ok: false, error: 'expected a WAV recording' })
    const dir = await mkdtemp(path.join(tmpdir(), 'augi-voice-'))
    const file = path.join(dir, 'order.wav')
    try {
      await writeFile(file, audio)
      const text = (await transcribe(file)).slice(0, MAX_TEXT)
      const saved = recordDir && url.searchParams.get('save') === '1'
        ? await saveRecording(recordDir, { audio, player, target, text, now: now() })
        : undefined
      if (!text) return json(res, 200, { ok: false, error: 'I did not hear anything. Try again, a bit louder.', saved })
      const line = formatVoiceChat(player, text, target)
      relay.say(line)
      log(`${player} -> ${target}: ${text}${saved ? ` (saved ${saved})` : ''}`)
      send({ type: 'heard', player, target, text })
      return json(res, 200, { ok: true, text, line, saved })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://local')
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        return res.end(await readFile(PAGE))
      }
      if (req.method === 'GET' && url.pathname === '/api/config') {
        return json(res, 200, { players, canSave: Boolean(recordDir), targets: targets.map(t => ({ ...t, online: relay.online?.(t.name) ?? null })) })
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
        res.write(': connected\n\n')
        clients.add(res)
        req.on('close', () => clients.delete(res))
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/talk') return await talk(req, res, url)
      json(res, 404, { ok: false, error: 'not found' })
    } catch (err) {
      log(`error: ${err.message}`)
      if (!res.headersSent) json(res, err.status ?? 500, { ok: false, error: err.message })
    }
  }
  handler.clients = clients
  return handler
}
