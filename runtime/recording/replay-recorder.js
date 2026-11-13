// Replay recorder: saves everything the server sends a bot as a ReplayMod
// replay (.mcpr), so a session can be replayed later with a free camera or
// rendered as a time-lapse. The format follows ReplayMod / ReplayStudio
// (fileFormatVersion 14): a zip with recording.tmcpr (records of
// [int32 ms][int32 length][varint packet id + data], starting with the login
// success packet, then configuration and play), metaData.json, markers.json.
//
// The server never sends a player its own body, so like ReplayMod's own
// recorder this adds the bot's spawn packet and its position every tick.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createRequire } from 'node:module'
import mc from 'minecraft-protocol'
import { buildZip } from './zip.js'

const require = createRequire(import.meta.url)
/** Protocol number of a Minecraft version (minecraft-data ships with minecraft-protocol). */
const protocolOf = version => require('minecraft-data')(version).version.version

export const FILE_FORMAT_VERSION = 14
const PI = Math.PI
const notchYaw = yaw => ((PI - yaw) * 180) / PI
const notchPitch = pitch => (-pitch * 180) / PI
export const angleByte = deg => { const b = Math.round((deg * 256) / 360) & 0xff; return b > 127 ? b - 256 : b }

/** One record of recording.tmcpr. */
export function encodeRecord (ms, packet) {
  const head = Buffer.alloc(8)
  head.writeInt32BE(ms, 0)
  head.writeInt32BE(packet.length, 4)
  return Buffer.concat([head, packet])
}

/** Parse recording.tmcpr back into { ms, packet } records (tests and tools). */
export function decodeRecords (buf) {
  const out = []
  for (let p = 0; p + 8 <= buf.length;) {
    const ms = buf.readInt32BE(p); const len = buf.readInt32BE(p + 4)
    out.push({ ms, packet: buf.subarray(p + 8, p + 8 + len) })
    p += 8 + len
  }
  return out
}

const stamp = (d = new Date()) => {
  const z = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}`
}
const mmss = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export class ReplayRecorder {
  /**
   * @param {object} opts
   * @param {string} opts.dir folder for the .mcpr files
   * @param {string} opts.name bot name, part of the file name
   * @param {string} [opts.version] Minecraft version of the connection
   * @param {number} [opts.protocol] protocol number (from minecraft-data when omitted)
   * @param {() => number} [opts.now]
   */
  constructor ({ dir, name, version = '26.3', protocol, now = Date.now, serverName = 'localhost' }) {
    this.dir = dir
    this.name = name
    this.version = version
    this.protocol = protocol ?? protocolOf(version)
    this.now = now
    this.serverName = serverName
    this.base = path.join(dir, `${stamp()}-${name}`)
    this.partFile = this.base + '.tmcpr.part'
    this.start = null // ms of the login success packet
    this.markers = []
    this.players = new Set()
    this.selfId = -1
    this.pending = []
    this.pendingBytes = 0
    this.closed = false
    this.last = null
    this.serializer = mc.createSerializer({ state: 'play', isServer: true, version })
    fs.mkdirSync(dir, { recursive: true })
    this.fd = fs.openSync(this.partFile, 'w')
    this.flushTimer = setInterval(() => this.flush(), 1000)
    this.flushTimer.unref?.()
  }

  get recording () { return this.start !== null && !this.closed }
  elapsed () { return this.start === null ? 0 : Math.max(0, this.now() - this.start) }

  /** Store one raw packet (varint id + data) received in a protocol state. */
  capture (state, buf, name) {
    if (this.closed) return
    if (this.start === null) {
      // Like ReplayMod, the recording starts with the login success packet.
      if (state !== 'login' || name !== 'success') return
      this.start = this.now()
    }
    this.write(Buffer.from(buf))
  }

  write (packet) {
    // Never let time step backwards (the wall clock can be adjusted mid-session).
    this.lastMs = Math.max(this.elapsed(), this.lastMs ?? 0)
    const rec = encodeRecord(this.lastMs, packet)
    this.pending.push(rec)
    this.pendingBytes += rec.length
    if (this.pendingBytes > 256 * 1024) this.flush()
  }

  flush () {
    if (!this.pending.length || this.fd == null) return
    fs.writeSync(this.fd, Buffer.concat(this.pending))
    this.pending = []
    this.pendingBytes = 0
  }

  /** A synthetic play packet for the bot's own entity. */
  writePlay (name, params) {
    if (!this.recording) return
    try { this.write(this.serializer.createPacketBuffer({ name, params })) } catch {}
  }

  spawnSelf (bot) {
    const e = bot.entity
    if (!e || this.selfId < 0) return
    const yaw = notchYaw(e.yaw ?? 0)
    this.writePlay('spawn_entity', {
      entityId: this.selfId,
      objectUUID: bot.player?.uuid ?? bot._client?.uuid,
      type: bot.registry.entitiesByName.player.id,
      x: e.position.x, y: e.position.y, z: e.position.z,
      velocity: { x: 0, y: 0, z: 0 },
      pitch: angleByte(notchPitch(e.pitch ?? 0)), yaw: angleByte(yaw), headPitch: angleByte(yaw),
      objectData: 0
    })
    this.last = null
    this.moveSelf(bot, true)
  }

  /** The bot's position and look, when they changed (or once a second). */
  moveSelf (bot, force = false) {
    const e = bot.entity
    if (!e || this.selfId < 0) return
    const now = { x: e.position.x, y: e.position.y, z: e.position.z, yaw: notchYaw(e.yaw ?? 0), pitch: notchPitch(e.pitch ?? 0) }
    const l = this.last
    const moved = !l || Math.abs(now.x - l.x) + Math.abs(now.y - l.y) + Math.abs(now.z - l.z) > 0.001 ||
      Math.abs(now.yaw - l.yaw) > 0.5 || Math.abs(now.pitch - l.pitch) > 0.5
    this.ticks = (this.ticks ?? 0) + 1
    if (!force && !moved && this.ticks % 20 !== 0) return
    this.writePlay('sync_entity_position', {
      entityId: this.selfId, positionPathType: 0, positionPath: { x: now.x, y: now.y, z: now.z },
      yRot: now.yaw, xRot: now.pitch, onGround: Boolean(e.onGround)
    })
    if (!l || Math.abs(now.yaw - l.yaw) > 0.5) this.writePlay('entity_head_rotation', { entityId: this.selfId, headYaw: angleByte(now.yaw) })
    this.last = now
  }

  addMarker (name, position = null) {
    if (!this.recording) return false
    const p = position ?? { x: 0, y: 0, z: 0 }
    this.markers.push({ realTimestamp: this.elapsed(), value: { name: String(name).slice(0, 120), position: { x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0, yaw: 0, pitch: 0, roll: 0 } } })
    return true
  }

  /** Finish the replay file. Returns its path, or null when nothing was recorded. */
  close () {
    if (this.closed) return this.file ?? null
    this.closed = true
    clearInterval(this.flushTimer)
    this.flush()
    fs.closeSync(this.fd)
    this.fd = null
    if (this.start === null) { fs.rmSync(this.partFile, { force: true }); return null }
    const recording = fs.readFileSync(this.partFile)
    const records = decodeRecords(recording)
    const duration = records.length ? records[records.length - 1].ms : 0
    const meta = {
      singleplayer: false,
      serverName: this.serverName,
      duration,
      date: this.start,
      mcversion: this.version,
      fileFormat: 'MCPR',
      fileFormatVersion: FILE_FORMAT_VERSION,
      protocol: this.protocol,
      generator: 'augi-craft replay recorder',
      selfId: this.selfId,
      players: [...this.players]
    }
    this.file = this.base + '.mcpr'
    fs.writeFileSync(this.file, buildZip([
      { name: 'metaData.json', data: Buffer.from(JSON.stringify(meta)) },
      { name: 'markers.json', data: Buffer.from(JSON.stringify(this.markers)) },
      { name: 'recording.tmcpr', data: recording },
      { name: 'recording.tmcpr.crc32', data: Buffer.from(String(zlib.crc32(recording))) }
    ]))
    // A shot list next to the replay: where the interesting moments are.
    const lines = this.markers.map(m => `${mmss(m.realTimestamp)}  ${m.value.name}`)
    fs.writeFileSync(this.base + '.markers.txt', `${path.basename(this.file)} (${mmss(duration)})\n${lines.join('\n')}\n`)
    fs.rmSync(this.partFile, { force: true })
    return this.file
  }
}

/**
 * Record a mineflayer bot: tap every deserializer the client creates (one per
 * protocol state) and add the bot's own entity. Closes on disconnect.
 */
export function recordBot (bot, recorder) {
  const client = bot._client
  const patch = () => {
    const d = client.deserializer
    if (!d || d.augiReplay || typeof d.parsePacketBuffer !== 'function') return
    d.augiReplay = true
    const parse = d.parsePacketBuffer.bind(d)
    // Recording must never break the bot's connection: on any recorder error
    // (disk full, a bad write) recording stops and the bot plays on.
    const safe = fn => { if (recorder.closed) return; try { fn() } catch (err) { console.error(`[replay] recording stopped: ${err.message}`); try { recorder.close() } catch {} } }
    d.parsePacketBuffer = buf => {
      const state = client.state
      let result
      try { result = parse(buf) } catch (err) { safe(() => recorder.capture(state, buf, null)); throw err }
      const name = result?.data?.name
      safe(() => {
        recorder.capture(state, buf, name)
        if (name === 'player_info') for (const p of result.data.params?.data ?? []) if (p.uuid) recorder.players.add(p.uuid)
      })
      return result
    }
  }
  patch()
  client.on?.('state', patch)
  client.on?.('packet', patch)
  bot.once?.('login', () => {
    recorder.selfId = bot.entity?.id ?? -1
    const uuid = bot.player?.uuid ?? client.uuid
    if (uuid) recorder.players.add(uuid)
  })
  const quiet = fn => () => { try { fn() } catch (err) { console.error(`[replay] ${err.message}`) } }
  bot.on?.('spawn', quiet(() => recorder.spawnSelf(bot)))
  bot.on?.('physicsTick', quiet(() => recorder.moveSelf(bot)))
  bot.once?.('end', () => recorder.close())
  bot.augiRecorder = recorder
  return recorder
}
