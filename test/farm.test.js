import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { farmWheat, nearWater } from '../runtime/tools/farm.js'
import { Vec3 } from 'vec3'

// Ground is dirt at y <= 63; the field center is a dirt block at 0,63,0.
const center = { x: 0, y: 63, z: 0 }

test('farm_wheat tills soil near water and plants carried seeds', async () => {
  const bot = new FakeBot({ inventory: { wooden_hoe: 1, wheat_seeds: 4 }, blocks: { '2,63,0': 'water' }, position: [0, 64, 5] })
  const res = await farmWheat(ctxFor(bot), { ...center, radius: 2, plots: 4 })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(res.observations.tilled, 4)
  assert.equal(res.observations.planted, 4)
  assert.equal(res.observations.crops, 4)
  assert.equal(bot.counts.wheat_seeds, 0)
  // Tilled plots sit next to the water.
  const crops = [...bot.world.entries()].filter(([, n]) => n === 'wheat').map(([k]) => new Vec3(...k.split(',').map(Number)).offset(0, -1, 0))
  assert.ok(crops.every(p => nearWater(bot, p)))
})

test('farm_wheat harvests only ripe wheat and replants the plot', async () => {
  const bot = new FakeBot({ inventory: { wooden_hoe: 1 }, blocks: { '0,63,0': 'farmland', '0,64,0': 'wheat', '1,63,0': 'farmland', '1,64,0': 'wheat' } })
  bot.props.set('0,64,0', { age: 7 })
  bot.props.set('1,64,0', { age: 3 })
  bot.extraDrops.wheat = 'wheat'
  const res = await farmWheat(ctxFor(bot), { ...center, radius: 2, plots: 2 })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(res.observations.harvested, 1)
  assert.equal(bot.counts.wheat, 1)
  assert.equal(res.observations.planted, 1, 'the harvested plot is replanted from its own seed drop')
  assert.equal(bot.world.get('1,64,0'), 'wheat', 'unripe wheat is left growing')
  assert.equal(res.observations.tilled, 0, 'no new plots beyond the requested two')
  assert.equal(res.observations.crops, 2)
})

test('farm_wheat breaks grass for seeds when it carries none', async () => {
  const bot = new FakeBot({ inventory: { stone_hoe: 1 }, blocks: { '3,64,3': 'short_grass', '4,64,3': 'short_grass' } })
  bot.extraDrops.short_grass = 'wheat_seeds'
  const res = await farmWheat(ctxFor(bot), { ...center, radius: 1, plots: 2 })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(res.observations.grassBroken, 2)
  assert.equal(res.observations.planted, 2)
})

test('farm_wheat crafts a wooden hoe when it has none', async () => {
  const bot = new FakeBot({ inventory: { wheat_seeds: 1, oak_planks: 4, stick: 2, crafting_table: 1 } })
  const res = await farmWheat(ctxFor(bot), { ...center, radius: 1, plots: 1 })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(bot.counts.wooden_hoe, 1)
  assert.equal(res.observations.planted, 1)
})

test('farm_wheat explains a missing seed source', async () => {
  const bot = new FakeBot({ inventory: { wooden_hoe: 1 } })
  const res = await farmWheat(ctxFor(bot), { ...center, radius: 1 })
  assert.equal(res.ok, false)
  assert.equal(res.error.category, 'missing_materials')
  assert.match(res.summary, /grass/)
})

test('farm_wheat clears snow layers from soil before tilling', async () => {
  const blocks = { '1,64,0': 'snow', '-1,64,0': 'snow', '0,64,1': 'snow', '0,64,-1': 'snow', '0,64,0': 'snow' }
  const bot = new FakeBot({ inventory: { wooden_hoe: 1, wheat_seeds: 2 }, blocks, position: [0, 64, 5] })
  const res = await farmWheat(ctxFor(bot), { ...center, radius: 1, plots: 2 })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(res.observations.planted, 2)
})

test('farm_wheat crafts no hoe when there is no soil to till', async () => {
  const bot = new FakeBot({ inventory: { wheat_seeds: 2, oak_planks: 4, stick: 2 }, groundY: 0, blocks: { '0,63,0': 'cobblestone' } })
  const res = await farmWheat(ctxFor(bot), { ...center, radius: 1 })
  assert.equal(res.ok, false)
  assert.equal(bot.counts.wooden_hoe, undefined)
})
