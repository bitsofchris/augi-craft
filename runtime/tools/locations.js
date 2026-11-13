// Named locations persisted as JSON in the knowledge base (knowledge/worlds/<world>/locations.json, one file per world).
import fs from 'node:fs'
import { lockMethods, atomicWrite } from '../memory/lock.js'
import path from 'node:path'
import { ErrorCategory, fail, ok, roundPos } from './result.js'

export class LocationStore {
  constructor (file) {
    this.file = file
    lockMethods(this, path.dirname(path.dirname(file)), ['save', 'get', 'list', 'remove'])
  }

  _read () {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')) } catch { return {} }
  }

  _write (data) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    atomicWrite(this.file, JSON.stringify(data, null, 2) + '\n')
  }

  save (name, position, { dimension = null, note = '' } = {}) {
    const data = this._read()
    data[name] = { name, position: roundPos(position), dimension, note, savedAt: new Date().toISOString() }
    this._write(data)
    return data[name]
  }

  get (name) { return this._read()[name] ?? null }
  list () { return Object.values(this._read()) }

  remove (name) {
    const data = this._read()
    const existed = name in data
    delete data[name]
    this._write(data)
    return existed
  }
}

/** save_location: remember the bot's position (or given coordinates) under a name. */
export async function saveLocation (ctx, { name, note = '', x, y, z }) {
  if (!ctx.locations) return fail(ErrorCategory.GAME_ERROR, 'No location store configured')
  const position = [x, y, z].every(Number.isFinite) ? { x, y, z } : ctx.bot.entity.position
  const loc = ctx.locations.save(name, position, { dimension: ctx.bot.game?.dimension ?? null, note })
  return ok(`Saved location "${name}" at ${loc.position.x}, ${loc.position.y}, ${loc.position.z}`, { location: loc })
}

/** recall_location: look up one saved location, or list all of them. */
export function recallLocation (locations, { name } = {}) {
  if (!name) {
    const all = locations.list()
    return ok(`${all.length} saved location(s)`, { locations: all })
  }
  const loc = locations.get(name)
  if (!loc) return fail(ErrorCategory.NOT_FOUND, `No saved location "${name}"`, { known: locations.list().map(l => l.name) })
  return ok(`"${name}" is at ${loc.position.x}, ${loc.position.y}, ${loc.position.z}`, { location: loc })
}
