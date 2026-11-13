// Where players were last seen by any worker. Every bot records the players it
// can see in knowledge/worlds/<world>/sightings.json (ignored by Git), so a bot that
// cannot see a player can walk to the newest sighting by a teammate.
// Writes are throttled per player and not locked: a racing write can drop one
// sighting, and the next one arrives a few seconds later.
import fs from 'node:fs'
import { atomicWrite } from '../memory/lock.js'

export class SightingStore {
  constructor (file, { minIntervalMs = 3000, now = () => Date.now() } = {}) {
    this.file = file
    this.minIntervalMs = minIntervalMs
    this.now = now
    this.lastWrite = {} // lowercase username -> ms of this process's last write
  }

  _read () {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')) } catch { return {} }
  }

  /** Record that `by` saw `username` at `position`; skipped if written too recently. */
  record ({ username, position, dimension = null, by = null }) {
    const key = username.toLowerCase()
    const t = this.now()
    if (t - (this.lastWrite[key] ?? -Infinity) < this.minIntervalMs) return false
    this.lastWrite[key] = t
    const data = this._read()
    data[key] = { username, position: { x: Math.round(position.x), y: Math.round(position.y), z: Math.round(position.z) }, dimension, by, at: new Date(t).toISOString() }
    atomicWrite(this.file, JSON.stringify(data, null, 2) + '\n')
    return true
  }

  get (username) { return this._read()[username.toLowerCase()] ?? null }
}
