import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { craftItem } from '../runtime/tools/craft.js'

test('craft_item stops after the first silent failure instead of spending a batch', async () => {
  const bot = new FakeBot({ inventory: { oak_log: 16 } })
  let attempts = 0
  bot.craft = async () => { attempts++; bot.add('oak_log', -1) }
  const result = await craftItem(ctxFor(bot), { item: 'oak_planks', count: 64 })
  assert.equal(attempts, 1)
  assert.equal(result.error.category, 'game_error')
  assert.equal(result.observations.crafted, 0)
  assert.deepEqual(result.observations.consumed, { oak_log: 1 })
  assert.equal(bot.counts.oak_log, 15)
})

test('craft_item retains consumption evidence when a slot update times out', async () => {
  const bot = new FakeBot({ inventory: { oak_log: 2 } })
  bot.craft = async () => { bot.add('oak_log', -1); throw new Error('updateSlot:0 timeout') }
  const result = await craftItem(ctxFor(bot), { item: 'oak_planks', count: 8 })
  assert.equal(result.error.category, 'timeout')
  assert.equal(result.observations.crafted, 0)
  assert.deepEqual(result.observations.consumed, { oak_log: 1 })
  assert.match(result.observations.craftError, /updateSlot:0/)
})

test('craft_item counts output that arrived before a later craft exception', async () => {
  const bot = new FakeBot({ inventory: { oak_log: 2 } })
  const craft = bot.craft.bind(bot)
  let attempts = 0
  bot.craft = async (...args) => {
    if (++attempts === 1) return craft(...args)
    throw new Error('server rejected click')
  }
  const result = await craftItem(ctxFor(bot), { item: 'oak_planks', count: 8 })
  assert.equal(result.error.category, 'partial')
  assert.equal(result.observations.crafted, 4)
  assert.equal(result.observations.completedCrafts, 1)
  assert.deepEqual(result.observations.consumed, { oak_log: 1 })
})
