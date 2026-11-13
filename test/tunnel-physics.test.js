import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Vec3 } from 'vec3'
import { install26_3CollisionDimensions } from '../runtime/bot/connect.js'
import { stepTo } from '../runtime/tools/navigate.js'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'

const require = createRequire(import.meta.url)
const data = require('minecraft-data')('26.3')
const { Physics, PlayerState } = require('prismarine-physics')
const Block = require('prismarine-block')(data)

test('stair jump collision stays outside the server float-width bounding box', () => {
  const world = {
    getBlock (position) {
      const solid = position.y < 0 || (position.y === 0 && position.z < 0)
      const block = Block.fromStateId(solid ? data.blocksByName.stone.minStateId : 0, 0)
      block.position = position.floored()
      return block
    }
  }
  function jump (fixed) {
    const bot = {
      version: '26.3', jumpTicks: 0, jumpQueued: false, inventory: { slots: [] },
      entity: { position: new Vec3(0.5, 0, 0.35), velocity: new Vec3(0, -0.0784, 0), onGround: true, attributes: {}, effects: {}, yaw: 0, pitch: 0 },
      physics: Physics(data, world)
    }
    if (fixed) install26_3CollisionDimensions(bot)
    const state = new PlayerState(bot, { forward: true, back: false, left: false, right: false, jump: true, sprint: false, sneak: false })
    bot.physics.simulatePlayer(state, world)
    return state
  }
  const serverHalfWidth = Math.fround(0.6) / 2
  assert.ok(jump(false).pos.z < serverHalfWidth, 'old physics overlaps the stair on the server')
  const corrected = jump(true)
  assert.ok(corrected.pos.y > 0, 'player actually begins jumping')
  assert.ok(corrected.pos.z >= serverHalfWidth, 'corrected jump does not clip the stair')
})

test('adjacent step refuses two-block climbs and obstructed body space', async () => {
  const bot = new FakeBot({ blocks: { '1,64,0': 'stone' } })
  assert.equal((await stepTo(ctxFor(bot), { x: 1, y: 66, z: 0 })).error.category, 'invalid_argument')
  assert.equal((await stepTo(ctxFor(bot), { x: 1, y: 64, z: 0 })).error.category, 'unreachable')
  assert.equal(bot.calls.length, 0)
})

test('walk-only navigation disables terrain changes and restores movement settings', async () => {
  const { navigateTo } = await import('../runtime/tools/navigate.js')
  const bot = new FakeBot()
  const original = { canDig: true, allow1by1towers: true, scafoldingBlocks: [1] }
  bot.pathfinder.movements = original
  bot.pathfinder.setMovements = m => { bot.pathfinder.movements = m }
  bot.pathfinder.goto = async () => {
    assert.equal(bot.pathfinder.movements.canDig, false)
    assert.equal(bot.pathfinder.movements.allow1by1towers, false)
    assert.deepEqual(bot.pathfinder.movements.scafoldingBlocks, [])
    throw new Error('No path to the goal!')
  }
  await assert.rejects(navigateTo(ctxFor(bot), { x: 20, y: 64, z: 0, walkOnly: true }))
  assert.equal(bot.pathfinder.movements, original)
})
