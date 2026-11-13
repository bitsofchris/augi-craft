import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { depositItems } from '../runtime/tools/inventory.js'

test('chest approach forbids digging/placing and restores movement settings', async () => {
  const bot = new FakeBot({ inventory: { cobblestone: 6 }, blocks: { '8,64,0': 'chest' } })
  const original = bot.pathfinder.movements
  bot.pathfinder.goto = async () => {
    assert.equal(bot.pathfinder.movements.canDig, false)
    assert.equal(bot.pathfinder.movements.allow1by1towers, false)
    assert.deepEqual(bot.pathfinder.movements.scafoldingBlocks, [])
    bot.entity.position = new Vec3(7, 64, 0)
  }
  const result = await depositItems(ctxFor(bot), { item: 'cobblestone', x: 8, y: 64, z: 0 })
  assert.equal(result.ok, true)
  assert.equal(bot.pathfinder.movements, original)
  assert.equal(bot.counts.cobblestone, 0)
})

test('blocked chest route stops before opening storage and restores movement', async () => {
  const bot = new FakeBot({ inventory: { cobblestone: 6 }, blocks: { '8,64,0': 'chest' } })
  const original = bot.pathfinder.movements
  bot.pathBlocked = true
  bot.openContainer = () => assert.fail('Do not open a chest through a blocked route')
  await assert.rejects(depositItems(ctxFor(bot), { item: 'cobblestone', x: 8, y: 64, z: 0 }), /Could not reach/)
  assert.equal(bot.pathfinder.movements, original)
  assert.equal(bot.counts.cobblestone, 6)
})
