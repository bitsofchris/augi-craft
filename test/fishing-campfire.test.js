import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { fishOnce } from '../runtime/tools/fishing.js'
import { cookCampfire } from '../runtime/tools/campfire.js'
import { gameTools } from '../runtime/tools/index.js'

const water = { x: 4, y: 63, z: 0, seconds: 1 }
function fishing () {
  const bot = new FakeBot({ inventory: { fishing_rod: 1 }, blocks: { '4,63,0': 'water' } })
  bot.unequip = async () => { bot.heldItem = null; bot.calls.push(['unequip']) }
  bot.fish = async () => { bot.add('cod', 1) }
  return bot
}
const station = { x: 1, y: 64, z: 0, item: 'cod', count: 4 }
function campfire () {
  const bot = new FakeBot({ inventory: { cod: 4 }, blocks: { '1,64,0': 'campfire' } })
  const original = bot.blockAt.bind(bot)
  bot.contents = []; bot.lit = true
  bot.blockAt = p => ({ ...original(p), blockEntity: { Items: bot.contents }, getProperties: () => ({ lit: bot.lit, waterlogged: false }) })
  bot.activateBlock = async () => { bot.add('cod', -1); bot.contents.push({ id: 'minecraft:cod' }); bot.calls.push(['activate']) }
  let ticks = 0
  bot.waitForTicks = async () => { if (++ticks === 600) { bot.add('cooked_cod', bot.contents.length); bot.contents = [] } }
  return bot
}

test('fish_once verifies actual catch and restores equipment', async () => {
  const bot = fishing()
  assert.equal(gameTools.find(t => t.name === 'fish_once').handler, fishOnce)
  const result = await fishOnce(ctxFor(bot), water)
  assert.equal(result.ok, true)
  assert.deepEqual(result.observations.caught, { cod: 1 })
  assert.equal(bot.heldItem, null)
})
test('fishing rejects missing rod, covered/hidden/distant water and full inventory', async () => {
  for (const change of [b => { b.counts = {} }, b => b.world.set('4,64,0', 'ice'), b => b.hiddenBlocks.add('4,63,0'), b => { b.entity.position.x = 20 }, b => { b.inventory.emptySlotCount = () => 0 }]) {
    const bot = fishing(); change(bot)
    assert.equal((await fishOnce(ctxFor(bot), water)).ok, false)
    assert.deepEqual(bot.calls, [])
  }
})
test('fishing bounds a hung cast, handles no pickup and plugin rejection', async () => {
  for (const mode of ['hung', 'empty', 'error']) {
    const bot = fishing()
    bot.fish = mode === 'hung' ? () => new Promise(() => {}) : mode === 'error' ? async () => { throw new Error('cancelled') } : async () => {}
    const result = await fishOnce(ctxFor(bot), water)
    assert.equal(result.error.category, { hung: 'timeout', empty: 'partial', error: 'game_error' }[mode])
    assert.equal(bot.calls.at(-1)[0], 'unequip')
  }
})
test('fishing cancellation retracts, and never casts if already aborted', async () => {
  const bot = fishing(); const ctx = ctxFor(bot)
  bot.fish = () => new Promise(() => {})
  bot.waitForTicks = async () => { ctx.signal.aborted = true }
  await assert.rejects(fishOnce(ctx, water), /interrupted/)
  assert.equal(bot.calls.at(-1)[0], 'unequip')
  const other = fishing(); const cancelled = ctxFor(other); cancelled.signal.aborted = true
  await assert.rejects(fishOnce(cancelled, water), /interrupted/)
  assert.deepEqual(other.calls, [])
})
test('campfire confirms a four-slot batch and inventory pickup', async () => {
  const bot = campfire(); bot.setControlState('sneak', true)
  assert.equal(gameTools.find(t => t.name === 'cook_campfire').handler, cookCampfire)
  const result = await cookCampfire(ctxFor(bot), station)
  assert.equal(result.ok, true)
  assert.equal(result.observations.cooked, 4)
  assert.equal(bot.counts.cod, 0)
  assert.equal(bot.getControlState('sneak'), true)
  assert.equal(bot.calls.filter(c => c[0] === 'activate').length, 4)
})
test('campfire rejects unlit, occupied, unknown, hidden and distant stations and missing food', async () => {
  for (const change of [b => { b.lit = false }, b => { b.contents = [{ id: 'minecraft:beef' }] }, b => { b.contents = undefined }, b => b.hiddenBlocks.add('1,64,0'), b => { b.entity.position.x = 10 }, b => { b.counts.cod = 0 }]) {
    const bot = campfire(); change(bot)
    assert.equal((await cookCampfire(ctxFor(bot), station)).ok, false)
    assert.deepEqual(bot.calls, [])
  }
  assert.equal((await cookCampfire(ctxFor(campfire()), { ...station, count: 5 })).error.category, 'invalid_argument')
})
test('campfire never retries an unconfirmed placement; reports missing cooked pickup', async () => {
  const bot = campfire(); bot.activateBlock = async () => { bot.calls.push(['activate']) }
  assert.equal((await cookCampfire(ctxFor(bot), station)).error.category, 'game_error')
  assert.equal(bot.calls.length, 2) // equip + single activation
  const noPickup = campfire(); noPickup.waitForTicks = async () => {}
  const result = await cookCampfire(ctxFor(noPickup), station)
  assert.equal(result.error.category, 'partial')
  assert.equal(result.observations.loaded, 4)
  assert.equal(result.observations.cooked, 0)
})
test('campfire cancellation prevents further loading and restores sneak', async () => {
  const bot = campfire(); const ctx = ctxFor(bot)
  bot.setControlState('sneak', true)
  bot.activateBlock = async () => { ctx.signal.aborted = true }
  await assert.rejects(cookCampfire(ctx, station), /interrupted/)
  assert.equal(bot.getControlState('sneak'), true)
  assert.equal(bot.counts.cod, 4)
})

test('campfire crafting accepts charcoal with spruce logs, without changing other recipes', async () => {
  const { craftItem, campfireFuelVariants } = await import('../runtime/tools/craft.js')
  const bot = new FakeBot({ inventory: { spruce_log: 3, charcoal: 1, stick: 3 }, blocks: { '1,64,0': 'crafting_table' } })
  assert.equal((await craftItem(ctxFor(bot), { item: 'campfire' })).ok, true)
  assert.equal(bot.counts.campfire, 1)
  assert.equal(bot.counts.charcoal, 0)
  assert.equal(bot.counts.spruce_log, 0)
  const recipes = bot.recipesAll(bot.registry.itemsByName.torch.id)
  assert.equal(campfireFuelVariants(bot.registry, 'torch', recipes), recipes)
})
