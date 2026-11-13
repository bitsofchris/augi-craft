---
id: build-hut
title: Build a hut
description: "Build a simple room: walls, flat roof and a doorway on the south side, from outside the walls, verifying each block; gathers the block type with obtain_item if short."
kind: program
level: 2
when:
  - player asks for a house, hut, shelter or room
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.buildHut({ origin: {x,y,z} north-west floor corner, size = 5, height = 3, block = 'cobblestone', door = true })"
status: candidate
source:
  origin: learned
  created: 2026-10-17T17:16:40.378Z
  updated: 2026-10-17T17:16:40.378Z
version: 1
evidence:
  - episode: 2026-10-17-17-55-59
    outcome: success
    note: 69/71 blocks
    date: 2026-10-17T17:55:59.616Z
stats:
  successes: 1
  failures: 0
failure_modes: []
tags:
  - builder
  - building
---

Build a simple room: walls, flat roof and a doorway on the south side, from outside the walls, verifying each block; gathers the block type with obtain_item if short.

Args: `{ origin: {x,y,z} north-west floor corner, size = 5, height = 3, block = 'cobblestone', door = true }`

## Code

```js
// Build a simple hut: size x size walls `height` high, flat roof, 2-high doorway
// on the south (+z) side. Builds from outside the walls, bottom layer first,
// and verifies every block. origin = the north-west floor corner.
const { origin, size = 5, height = 3, block = 'cobblestone', door = true } = args
const o = new Vec3(Math.floor(origin.x), Math.floor(origin.y), Math.floor(origin.z))
const n = name => bot.inventory.items().filter(i => i.name === name).reduce((s, i) => s + i.count, 0)
const plan = []
for (let y = 0; y < height; y++) for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) {
  const edge = x === 0 || z === 0 || x === size - 1 || z === size - 1
  const doorway = door && z === size - 1 && x === Math.floor(size / 2) && y < 2
  if (edge && !doorway) plan.push(o.offset(x, y, z))
}
for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) plan.push(o.offset(x, height, z))
const need = plan.filter(p => !bot.blockAt(p) || bot.blockAt(p).boundingBox !== 'block').length
if (n(block) < need) {
  const got = await lib.obtain_item({ item: block, count: need })
  log(`materials: ${got.summary}`)
  if (n(block) < need) bot.chat(`I only have ${n(block)}/${need} ${block}; building what I can`)
}
const FACES = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]
const placed = []; const failed = []
const centre = o.offset((size - 1) / 2, 0, (size - 1) / 2)
async function placeAt (p) {
  const here = bot.blockAt(p)
  if (here?.boundingBox === 'block') return true
  // Stand outside the footprint, on the side facing this block, about 2 blocks out.
  const out = p.minus(centre); out.y = 0
  const len = Math.max(Math.abs(out.x), Math.abs(out.z)) || 1
  const stand = centre.offset(Math.round(out.x / len * ((size + 3) / 2)), 0, Math.round(out.z / len * ((size + 3) / 2)))
  if (bot.entity.position.distanceTo(p.offset(0.5, 0.5, 0.5)) > 4.2 || (bot.entity.position.floored().x >= o.x && bot.entity.position.floored().x < o.x + size && bot.entity.position.floored().z >= o.z && bot.entity.position.floored().z < o.z + size)) {
    try { await bot.pathfinder.goto(new goals.GoalNear(stand.x, o.y, stand.z, 1)) } catch (e) { log('stand: ' + e.message) }
  }
  for (const [dx, dy, dz] of FACES) {
    const ref = bot.blockAt(p.offset(dx, dy, dz))
    if (!ref || ref.boundingBox !== 'block') continue
    const item = bot.inventory.items().find(i => i.name === block)
    if (!item) return false
    await bot.equip(item, 'hand')
    try {
      await bot.placeBlock(ref, new Vec3(-dx, -dy, -dz))
    } catch (e) { continue }
    if (bot.blockAt(p)?.boundingBox === 'block') return true
  }
  return false
}
let pending = plan
for (let pass = 0; pass < 3 && pending.length; pass++) {
  const next = []
  for (const p of pending) { if (await placeAt(p)) placed.push(p); else next.push(p) }
  pending = next
}
failed.push(...pending)
bot.pathfinder.setGoal(null)
const done = plan.length - failed.length
bot.chat(failed.length ? `hut ${done}/${plan.length} blocks done; ${failed.length} spots I could not reach` : `your hut is ready at ${o.x} ${o.y} ${o.z}! door on the south side`)
return { blocks: plan.length, done, failed: failed.slice(0, 10).map(p => `${p.x},${p.y},${p.z}`) }
```
