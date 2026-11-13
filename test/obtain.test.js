import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { obtainItem } from '../runtime/tools/obtain.js'

const tree = (x, z, h = 4, wood = 'oak') => Object.fromEntries(Array.from({ length: h }, (_, i) => [`${x},${64 + i},${z}`, `${wood}_log`]))

test('obtain plans a wooden pickaxe from standing trees', async () => {
  const bot = new FakeBot({ blocks: { ...tree(3, 0), ...tree(-3, 2) } })
  const res = await obtainItem(ctxFor(bot), { item: 'wooden_pickaxe' })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(bot.counts.wooden_pickaxe, 1)
  assert.ok(res.observations.steps.some(s => s.startsWith('gather')))
  assert.ok(res.observations.steps.some(s => s.startsWith('craft crafting_table')))
})

test('obtain gets a wooden pickaxe before mining cobblestone for a stone pickaxe', async () => {
  const stone = Object.fromEntries([1, 2, 3, 4].flatMap(x => [[`${x},63,1`, 'stone'], [`${x},62,1`, 'stone']]))
  const bot = new FakeBot({ blocks: { ...tree(3, 0, 6), ...stone } })
  const res = await obtainItem(ctxFor(bot), { item: 'stone_pickaxe' })
  assert.equal(res.ok, true, JSON.stringify(res.observations.steps))
  assert.equal(bot.counts.stone_pickaxe, 1)
  const steps = res.observations.steps.join('\n')
  assert.ok(steps.indexOf('craft wooden_pickaxe') < steps.indexOf('gather cobblestone x3: Collected'), steps)
})

test('obtain crafts torches from coal and loose plural names', async () => {
  const bot = new FakeBot({ inventory: { coal: 2, stick: 2 } })
  const res = await obtainItem(ctxFor(bot), { item: 'torches', count: 8 })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(bot.counts.torch, 8)
  assert.equal(bot.counts.coal, 0)
})

test('obtain falls back to charcoal torches when no coal ore is visible', async () => {
  const bot = new FakeBot({ inventory: { oak_log: 3, crafting_table: 1, furnace: 1 } })
  const res = await obtainItem(ctxFor(bot), { item: 'torch', count: 4 })
  assert.equal(res.ok, true, JSON.stringify(res.observations.steps))
  assert.equal(bot.counts.torch, 4)
  assert.ok(res.observations.steps.some(s => s.includes('-> charcoal')), res.observations.steps.join('\n'))
})

test('obtain smelts iron ingots, building a furnace from cobblestone', async () => {
  const bot = new FakeBot({ inventory: { raw_iron: 3, cobblestone: 8, oak_planks: 8 } })
  const res = await obtainItem(ctxFor(bot), { item: 'iron_ingot', count: 3 })
  assert.equal(res.ok, true, JSON.stringify(res.observations.steps))
  assert.equal(bot.counts.iron_ingot, 3)
  assert.ok(res.observations.steps.some(s => s.startsWith('craft furnace')))
})

test('obtain explains what it cannot make', async () => {
  const bot = new FakeBot()
  const food = await obtainItem(ctxFor(bot), { item: 'cooked_beef', count: 2 })
  assert.equal(food.ok, false)
  assert.equal(food.error.category, 'not_found')
  assert.match(food.summary, /hunt/)
  const diamonds = await obtainItem(ctxFor(new FakeBot({ inventory: { iron_pickaxe: 1 } })), { item: 'diamond', count: 1 })
  assert.equal(diamonds.ok, false)
  assert.match(diamonds.summary, /underground/)
  const unknown = await obtainItem(ctxFor(bot), { item: 'not_an_item' }).catch(e => e)
  assert.match(unknown.message, /Unknown item/)
})

test('obtain returns at once when the inventory already has enough', async () => {
  const bot = new FakeBot({ inventory: { torch: 10 } })
  const res = await obtainItem(ctxFor(bot), { item: 'torch', count: 5 })
  assert.equal(res.ok, true)
  assert.deepEqual(res.observations.steps, [])
})

test('obtain keeps pathfinder scaffolding off its ingredients and restores it', async () => {
  const bot = new FakeBot({ inventory: { torch: 1 } })
  const dirt = bot.registry.itemsByName.dirt.id
  const cobble = bot.registry.itemsByName.cobblestone.id
  bot.pathfinder.movements.scafoldingBlocks = [dirt, cobble]
  let during = null
  bot.recipesAll = () => { during = [...bot.pathfinder.movements.scafoldingBlocks]; return [] }
  await obtainItem(ctxFor(bot), { item: 'lever', count: 1 })
  assert.deepEqual(during, [dirt])
  assert.deepEqual(bot.pathfinder.movements.scafoldingBlocks, [dirt, cobble])
})

test('obtain switches wood species when the preferred trees are out of reach', async () => {
  const bot = new FakeBot({ blocks: { '2,64,0': 'cherry_log', ...tree(6, 0, 4, 'spruce') } })
  bot.unreachable.add('2,64,0')
  const res = await obtainItem(ctxFor(bot), { item: 'stick', count: 4 })
  assert.equal(res.ok, true, JSON.stringify(res.observations?.steps))
  assert.equal(bot.counts.stick, 4)
  assert.ok(res.observations.steps.some(s => s.startsWith('no cherry_log nearby')), res.observations.steps.join('\n'))
  assert.ok(bot.counts.spruce_planks >= 0 && !bot.counts.cherry_planks)
})

test('obtain picks up the crafting table it placed', async () => {
  const bot = new FakeBot({ inventory: { oak_planks: 3, stick: 2, crafting_table: 1 } })
  const res = await obtainItem(ctxFor(bot), { item: 'wooden_pickaxe' })
  assert.equal(res.ok, true, JSON.stringify(res.observations.steps))
  assert.equal(bot.counts.crafting_table, 1, res.observations.steps.join('\n'))
  assert.ok(res.observations.steps.some(s => s.startsWith('picked up the crafting_table')))
})

test('obtain uses visible coal for smelting fuel when no wood is around', async () => {
  const bot = new FakeBot({ inventory: { raw_iron: 3, furnace: 1, stone_pickaxe: 1 }, blocks: { '2,64,0': 'coal_ore' } })
  const res = await obtainItem(ctxFor(bot), { item: 'iron_ingot', count: 3 })
  assert.equal(res.ok, true, JSON.stringify(res.observations.steps))
  assert.ok(res.observations.steps.some(s => s.startsWith('gather coal')), res.observations.steps.join('\n'))
})

test('obtain says when a full inventory blocks crafting', async () => {
  const bot = new FakeBot({ inventory: { oak_planks: 4 } })
  bot.inventory.emptySlotCount = () => 0
  const res = await obtainItem(ctxFor(bot), { item: 'stick', count: 4 })
  assert.equal(res.error.category, 'inventory_full')
  assert.match(res.summary, /drop or store/)
})

test('obtain gets string from cobwebs with a sword for a fishing rod', async () => {
  const bot = new FakeBot({ inventory: { wooden_sword: 1, stick: 3, crafting_table: 1 }, blocks: { '2,64,0': 'cobweb', '3,64,0': 'cobweb' } })
  const res = await obtainItem(ctxFor(bot), { item: 'fishing_rod' })
  assert.equal(res.ok, true, JSON.stringify(res.observations.steps))
  assert.equal(bot.counts.fishing_rod, 1)
})

test('obtain says where string comes from when no cobweb is near', async () => {
  const bot = new FakeBot({ inventory: { stick: 3, wooden_sword: 1 } })
  const res = await obtainItem(ctxFor(bot), { item: 'fishing_rod' })
  assert.equal(res.ok, false)
  assert.match(res.summary, /spiders/)
})

test('obtain walks to trees it can see beyond its gathering range', async () => {
  const bot = new FakeBot({ blocks: tree(100, 0, 4, 'birch') })
  const res = await obtainItem(ctxFor(bot), { item: 'stick', count: 4 })
  assert.equal(res.ok, true, JSON.stringify(res.observations?.steps))
  assert.equal(bot.counts.stick, 4)
  assert.ok(res.observations.steps.some(s => /^walked \d+ blocks to trees seen/.test(s)), res.observations.steps.join('\n'))
})

test('obtain searches outward in a spiral when no tree is loaded', async () => {
  const bot = new FakeBot({ blocks: tree(180, 0, 4, 'spruce') })
  const res = await obtainItem(ctxFor(bot), { item: 'wooden_pickaxe' })
  assert.equal(res.ok, true, JSON.stringify(res.observations?.steps))
  assert.equal(bot.counts.wooden_pickaxe, 1)
  assert.ok(res.observations.steps.some(s => s.includes('looking for trees; found some')), res.observations.steps.join('\n'))
  assert.ok(bot.counts.spruce_planks >= 0 && !bot.counts.oak_planks)
})

test('obtain reports how far it walked when it cannot reach any trees', async () => {
  const bot = new FakeBot()
  bot.pathfinder.goto = async () => { throw new Error('No path to the goal!') }
  const res = await obtainItem(ctxFor(bot), { item: 'wooden_pickaxe' })
  assert.equal(res.ok, false)
  assert.equal(res.error.category, 'not_found')
  assert.match(res.summary, /no trees found after walking 0 blocks; run again/)
})
