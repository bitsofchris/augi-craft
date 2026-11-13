import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot } from './helpers/fake-bot.js'
import { digTunnel, stepCells, DIRECTIONS } from '../runtime/tools/tunnel.js'

// A bot standing on the ground at 0,64,0 that walks exactly onto the goal block.
function bot (opts = {}) {
  const b = new FakeBot({ position: [0.5, 64, 0.5], ...opts })
  b.pathfinder.goto = async g => { b.calls.push(['goto', g.x, g.y, g.z]); b.entity.position = new Vec3(g.x + 0.5, g.y, g.z + 0.5) }
  b.waitForTicks = async () => {}
  b.equip = async item => { b.heldItem = item }
  return b
}
const ctx = b => ({ bot: b, checkAbort () {} })
const stone = (b, cells) => { for (const c of cells) b.world.set(c, 'stone') }

test('a level tunnel through stone clears 1x2, walks in and lists the ore it uncovers', async () => {
  const b = bot({ inventory: { stone_pickaxe: 1 } })
  stone(b, ['1,64,0', '1,65,0', '2,64,0', '2,65,0', '3,64,0', '3,65,0'])
  b.world.set('2,66,0', 'coal_ore')
  const r = await digTunnel(ctx(b), { direction: 'east', length: 3 })
  assert.equal(r.ok, true, r.summary)
  assert.equal(r.observations.steps, 3)
  assert.deepEqual(b.entity.position.floored(), new Vec3(3, 64, 0))
  for (const c of ['1,64,0', '1,65,0', '3,64,0', '3,65,0']) assert.equal(b.world.get(c), 'air', c)
  assert.deepEqual(r.observations.oresSeen.map(o => [o.name, o.x, o.y, o.z]), [['coal_ore', 2, 66, 0]])
  assert.equal(b.world.get('2,66,0'), 'coal_ore', 'ore is reported, not mined')
})

test('a staircase down ends one block lower per step', async () => {
  const b = bot()
  const r = await digTunnel(ctx(b), { direction: 'south', length: 3, slope: 'down' })
  assert.equal(r.ok, true, r.summary)
  assert.deepEqual(b.entity.position.floored(), new Vec3(0, 61, 3))
  assert.deepEqual(stepCells(new Vec3(0, 64, 0), DIRECTIONS.south, 'down').feet, new Vec3(0, 63, 1))
})

test('it stops before digging next to lava and reports how far it got', async () => {
  const b = bot({ inventory: { stone_pickaxe: 1 } })
  stone(b, ['1,64,0', '1,65,0', '2,64,0', '2,65,0'])
  b.world.set('3,64,0', 'lava')
  const r = await digTunnel(ctx(b), { direction: 'east', length: 5 })
  assert.equal(r.ok, false)
  assert.equal(r.error.category, 'partial')
  assert.equal(r.observations.steps, 1)
  assert.match(r.observations.stoppedBecause, /lava/)
  assert.equal(b.world.get('2,64,0'), 'stone', 'the block next to lava is left in place')
})

test('stone without a pickaxe is a missing tool, before any step', async () => {
  const b = bot()
  stone(b, ['1,64,0', '1,65,0'])
  const r = await digTunnel(ctx(b), { direction: 'east', length: 2 })
  assert.equal(r.ok, false)
  assert.equal(r.error.category, 'missing_tool')
  assert.equal(r.observations.steps, 0)
})

test('an open drop is patched with a carried block, or stops the tunnel without one', async () => {
  const hole = b => { b.world.set('1,63,0', 'air'); b.world.set('1,62,0', 'air'); b.world.set('1,61,0', 'air') }
  const without = bot()
  hole(without)
  const stopped = await digTunnel(ctx(without), { direction: 'east', length: 2 })
  assert.equal(stopped.error.category, 'unreachable')
  assert.match(stopped.observations.stoppedBecause, /open drop/)

  const withFill = bot({ inventory: { cobblestone: 4 } })
  hole(withFill)
  const patched = await digTunnel(ctx(withFill), { direction: 'east', length: 2 })
  assert.equal(patched.ok, true, patched.summary)
  assert.equal(withFill.world.get('1,63,0'), 'cobblestone')
})

test('stopAtOre stops at the first step that uncovers ore', async () => {
  const b = bot({ inventory: { stone_pickaxe: 1 } })
  stone(b, ['1,64,0', '1,65,0', '2,64,0', '2,65,0', '3,64,0', '3,65,0', '4,64,0', '4,65,0'])
  // Ore only comes into sight once the tunnel reaches it.
  b.canSeeBlock = blk => blk.position.x <= b.entity.position.x + 1
  b.world.set('2,63,1', 'iron_ore')
  const r = await digTunnel(ctx(b), { direction: 'east', length: 4, stopAtOre: true })
  assert.equal(r.ok, true, r.summary)
  assert.equal(r.observations.steps, 1)
  assert.match(r.summary, /ore in sight/)
})
