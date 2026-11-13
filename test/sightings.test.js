import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SightingStore } from '../runtime/tools/sightings.js'
import { searchWaypoints } from '../runtime/tools/players.js'

const tempFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'augi-sight-')), 'world', 'sightings.json')

test('sightings are shared through one file and throttled per player', () => {
  let t = 0
  const file = tempFile()
  const mine = new SightingStore(file, { now: () => t })
  const teammate = new SightingStore(file, { now: () => t })
  assert.equal(mine.record({ username: '.Kid', position: { x: 1.4, y: 64, z: 2.6 }, by: 'Guard' }), true)
  assert.deepEqual(teammate.get('.kid').position, { x: 1, y: 64, z: 3 })
  t = 1000
  assert.equal(mine.record({ username: '.Kid', position: { x: 50, y: 64, z: 50 }, by: 'Guard' }), false)
  assert.equal(teammate.record({ username: '.Kid', position: { x: 9, y: 70, z: 9 }, by: 'Hunter' }), true)
  assert.equal(mine.get('.KID').by, 'Hunter')
  assert.equal(mine.get('nobody'), null)
})

test('search waypoints start at the sighting and widen ring by ring', () => {
  const points = searchWaypoints({ x: 100, y: 64, z: 100 })
  assert.equal(points.length, 19)
  assert.deepEqual(points[0], { x: 100, y: 64, z: 100 })
  assert.deepEqual(points[1], { x: 196, y: 64, z: 100 })
  const dist = p => Math.hypot(p.x - 100, p.z - 100)
  assert.ok(points.every((p, i) => i === 0 || dist(p) >= dist(points[i - 1]) - 1))
})
