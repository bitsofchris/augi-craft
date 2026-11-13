import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { BotSession } from '../runtime/bot/session.js'
import { install26_3PlayerActionFix, installResourceAwarePathfinder, waitForNearbyChunks } from '../runtime/bot/connect.js'
import { diffCounts, categorize, ToolError, ErrorCategory } from '../runtime/tools/result.js'
import { resolveBlockNames, dropNames } from '../runtime/tools/world.js'
import { observe } from '../runtime/tools/observe.js'
import { findBlocksTool, navigateTo, gotoWithProgress, goNear } from '../runtime/tools/navigate.js'
import pathfinderPkg from 'mineflayer-pathfinder'
import { gatherBlocks, digBlockAt } from '../runtime/tools/gather.js'
import { craftItem } from '../runtime/tools/craft.js'
import { smeltItem, chooseFuel } from '../runtime/tools/smelt.js'
import { equipItem, depositItems, withdrawItems } from '../runtime/tools/inventory.js'
import { placeBlock } from '../runtime/tools/place.js'
import { gameTools } from '../runtime/tools/index.js'
import { findPlayer, giveItems } from '../runtime/tools/players.js'

const trees = { '3,64,0': 'oak_log', '3,65,0': 'oak_log', '3,66,0': 'oak_log', '-4,64,2': 'birch_log', '-4,65,2': 'birch_log' }

test('dig_block clears specified nearby headroom and refuses hidden blocks', async () => {
  const bot = new FakeBot({ inventory: { stone_pickaxe: 1 }, blocks: { '0,66,0': 'stone', '1,66,0': 'stone' }, hiddenBlocks: ['1,66,0'] })
  assert.equal((await digBlockAt(ctxFor(bot), { x: 1, y: 66, z: 0 })).error.category, 'unreachable')
  assert.equal((await digBlockAt(ctxFor(bot), { x: 0, y: 66, z: 0 })).ok, true)
  assert.equal(bot.nameAt({ x: 0, y: 66, z: 0 }), 'air')
  assert.equal(bot.nameAt({ x: 1, y: 66, z: 0 }), 'stone')
})

test('player handoff selects the exact Bedrock name and verifies that recipient pickup', async () => {
  const bot = new FakeBot({ inventory: { diamond: 6 } })
  const son = { id: 7, position: bot.entity.position.offset(1, 0, 0) }
  bot.players = { '.Kid2': { username: '.Kid2', entity: son }, Operator: { username: 'Operator' } }
  bot.toss = async (type, metadata, count) => {
    bot.add('diamond', -count)
    bot.emit('playerCollect', son, { getDroppedItem: () => ({ name: 'diamond', count }) })
  }
  assert.equal((await findPlayer(ctxFor(bot), { username: '.kid2' })).observations.visible, true)
  const result = await giveItems(ctxFor(bot), { username: '.Kid2', item: 'diamond' })
  assert.equal(result.ok, true)
  assert.equal(result.observations.received, 6)
  assert.equal(bot.counts.diamond, 0)
  assert.equal(bot.listenerCount('playerCollect'), 0)
})

test('handoff refuses an invisible recipient and does not claim another player pickup', async () => {
  const bot = new FakeBot({ inventory: { diamond: 6 } })
  bot.players = { Player1: { username: 'Player1' } }
  assert.equal((await giveItems(ctxFor(bot), { username: 'Player1', item: 'diamond' })).error.category, 'not_found')
  assert.equal(bot.counts.diamond, 6)
  bot.players.Player1.entity = { id: 7, position: bot.entity.position.offset(1, 0, 0) }
  bot.toss = async (type, metadata, count) => {
    bot.add('diamond', -count)
    bot.emit('playerCollect', { id: 8 }, { getDroppedItem: () => ({ name: 'diamond', count }) })
  }
  const result = await giveItems(ctxFor(bot), { username: 'Player1', item: 'diamond' })
  assert.equal(result.error.category, 'partial')
  assert.equal(result.observations.received, 0)
})

test('connection waits for nearby terrain before exposing the bot', async () => {
  let release
  let ready = false
  const bot = { waitForChunksToLoad: () => new Promise(resolve => { release = () => { ready = true; resolve() } }) }
  const pending = waitForNearbyChunks(bot)
  assert.equal(ready, false)
  release()
  await pending
  assert.equal(ready, true)
})

test('26.3 uses shifted finish and abort digging actions', () => {
  const packets = []
  const bot = { version: '26.3', _client: { write: (name, params) => packets.push([name, params.status]) } }
  install26_3PlayerActionFix(bot)
  for (const status of [0, 1, 2, 3, 4, 5, 6, 7]) bot._client.write('block_dig', { status })
  bot._client.write('other', { status: 2 })
  assert.deepEqual(packets, [['block_dig', 0], ['block_dig', 2], ['block_dig', 3], ['block_dig', 4], ['block_dig', 5], ['block_dig', 6], ['block_dig', 7], ['block_dig', 8], ['other', 2]])
})

test('pathfinder reserves iron pickaxe for blocks that need it', () => {
  const stone = { name: 'stone_pickaxe', type: 1 }
  const iron = { name: 'iron_pickaxe', type: 2 }
  const bot = {
    inventory: { items: () => [stone, iron] },
    pathfinder: { bestHarvestTool: () => iron }
  }
  installResourceAwarePathfinder(bot)
  assert.equal(bot.pathfinder.bestHarvestTool({ canHarvest: type => type === 1 || type === 2, harvestTools: { 1: true, 2: true } }), stone)
  assert.equal(bot.pathfinder.bestHarvestTool({ canHarvest: type => type === 2, harvestTools: { 2: true } }), iron)
  assert.equal(bot.pathfinder.bestHarvestTool({ canHarvest: () => true, harvestTools: null }), null)
})

test('diffCounts reports only changed items', () => {
  assert.deepEqual(diffCounts({ a: 1, b: 2 }, { a: 1, b: 5, c: 1 }), { b: 3, c: 1 })
  assert.deepEqual(diffCounts({ a: 2 }, {}), { a: -2 })
})

test('categorize maps common mineflayer errors', () => {
  assert.equal(categorize(new Error('No path to the goal!')), 'unreachable')
  assert.equal(categorize(new ToolError(ErrorCategory.NO_STATION, 'x')), 'no_station')
  assert.equal(categorize(new Error('Event blockUpdate did not fire within timeout of 5000ms')), 'timeout')
})

test('resolveBlockNames expands aliases', () => {
  const { registry } = new FakeBot()
  const logs = resolveBlockNames(registry, 'log')
  assert.ok(logs.includes('oak_log') && logs.includes('birch_log'))
  assert.ok(logs.every(n => n.endsWith('_log') && !n.startsWith('stripped_')))
  assert.deepEqual(resolveBlockNames(registry, 'iron'), ['iron', 'iron_ore', 'deepslate_iron_ore'].filter(n => registry.blocksByName[n]))
  assert.throws(() => resolveBlockNames(registry, 'unobtainium'), /Unknown block/)
  assert.deepEqual(dropNames(registry, 'stone'), ['cobblestone'])
})

test('observe summarizes inventory, notable blocks and locations', async () => {
  const bot = new FakeBot({ inventory: { oak_log: 2 }, blocks: trees })
  const res = await observe(ctxFor(bot, { locations: { list: () => [{ name: 'base' }] } }), {})
  assert.equal(res.ok, true)
  assert.deepEqual(res.observations.inventory, { oak_log: 2 })
  assert.equal(res.observations.notable.log.name, 'oak_log')
  assert.deepEqual(res.observations.savedLocations, ['base'])
  assert.ok(res.observations.nearbyBlocks.dirt > 0)
})

test('find_blocks returns nearest first, not_found otherwise', async () => {
  const bot = new FakeBot({ blocks: trees })
  const res = await findBlocksTool(ctxFor(bot), { block: 'log' })
  assert.equal(res.ok, true)
  assert.equal(res.observations.blocks[0].name, 'oak_log')
  const none = await findBlocksTool(ctxFor(bot), { block: 'diamond_ore' })
  assert.equal(none.error.category, 'not_found')
})

test('ore searches and gathering ignore blocks hidden behind stone', async () => {
  const bot = new FakeBot({
    inventory: { stone_pickaxe: 1 },
    blocks: { '2,64,0': 'iron_ore', '3,64,0': 'iron_ore' },
    hiddenBlocks: ['2,64,0']
  })
  const found = await findBlocksTool(ctxFor(bot), { block: 'iron', maxDistance: 8, count: 2 })
  assert.equal(found.ok, true)
  assert.deepEqual(found.observations.blocks.map(b => b.position.x), [3])
  const seen = await observe(ctxFor(bot), {})
  assert.equal(seen.observations.nearbyBlocks.iron_ore, 1)
  const mined = await gatherBlocks(ctxFor(bot), { block: 'iron', count: 1, maxDistance: 8 })
  assert.equal(mined.ok, true)
  assert.equal(bot.counts.raw_iron, 1)
  assert.equal(bot.nameAt({ x: 2, y: 64, z: 0 }), 'iron_ore')
})

test('navigate_to supports coordinates, blocks and saved locations', async () => {
  const bot = new FakeBot({ blocks: trees })
  const locations = { get: n => n === 'base' ? { name: 'base', position: { x: 10, y: 64, z: 10 } } : null, list: () => [] }
  assert.equal((await navigateTo(ctxFor(bot, { locations }), { x: 20, y: 64, z: 0 })).ok, true)
  assert.equal((await navigateTo(ctxFor(bot, { locations }), { location: 'base' })).ok, true)
  assert.equal((await navigateTo(ctxFor(bot, { locations }), { location: 'nowhere' })).error.category, 'not_found')
  assert.equal((await navigateTo(ctxFor(bot, { locations }), {})).error.category, 'invalid_argument')
  bot.pathBlocked = true
  await assert.rejects(navigateTo(ctxFor(bot, { locations }), { x: 100, y: 64, z: 100 }), e => e.category === 'unreachable')
  assert.deepEqual(bot.calls.slice(-3), [['pathfinder.stop'], ['setGoal', null], ['clearControlStates']])
})

test('navigation detects a stationary path and removes progress listeners', async () => {
  const bot = new FakeBot()
  bot.pathfinder.goto = async () => {
    bot.emit('path_update', { status: 'success', path: [1] })
    bot.emit('path_reset', 'place_error')
    await new Promise(() => {})
  }
  bot.pathfinder.isBuilding = () => true
  const goal = new pathfinderPkg.goals.GoalNear(10, 64, 0, 0)
  await assert.rejects(gotoWithProgress(ctxFor(bot), goal, { stallMs: 20, pollMs: 5 }), err => {
    assert.equal(err.observations.stalled, true)
    assert.equal(err.observations.building, true)
    assert.equal(err.observations.lastReset, 'place_error')
    return err.category === 'unreachable'
  })
  for (const event of ['diggingCompleted', 'blockPlaced', 'path_update', 'path_reset']) assert.equal(bot.listenerCount(event), 0)
})

test('navigation recognizes physical arrival if the goto promise never completes', async () => {
  const bot = new FakeBot()
  bot.pathfinder.goto = async goal => {
    bot.entity.position = bot.entity.position.offset(goal.x, 0, 0)
    await new Promise(() => {})
  }
  await gotoWithProgress(ctxFor(bot), new pathfinderPkg.goals.GoalNear(10, 64, 0, 0), { stallMs: 50, pollMs: 5 })
  assert.deepEqual(bot.calls.slice(-3), [['pathfinder.stop'], ['setGoal', null], ['clearControlStates']])
})

test('ongoing digging counts as navigation progress even while stationary', async () => {
  const bot = new FakeBot()
  let heartbeat
  bot.pathfinder.goto = async () => {
    heartbeat = setInterval(() => bot.emit('diggingCompleted'), 5)
    await new Promise(resolve => setTimeout(resolve, 60))
  }
  try {
    await gotoWithProgress(ctxFor(bot), new pathfinderPkg.goals.GoalNear(10, 64, 0, 0), { stallMs: 25, pollMs: 5 })
  } finally { clearInterval(heartbeat) }
  assert.equal(bot.listenerCount('diggingCompleted'), 0)
})

test('zero-range navigation accepts a saved fractional position in the current block', async () => {
  const bot = new FakeBot()
  const res = await navigateTo(ctxFor(bot), { x: 0.4, y: 64, z: 0.4, range: 0 })
  assert.equal(res.ok, true)
  assert.equal(bot.calls.some(c => c[0] === 'goto'), false)
})

test('a stalled navigation replans once, then stops with diagnostics', async t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] })
  const bot = new FakeBot()
  let calls = 0
  bot.pathfinder.goto = async () => { calls++; await new Promise(() => {}) }
  const checked = assert.rejects(goNear(ctxFor(bot), { x: 10, y: 64, z: 0 }, 0), err => {
    assert.equal(err.observations.replans, 1)
    assert.equal(err.observations.stalled, true)
    return true
  })
  for (let i = 0; i < 12; i++) await Promise.resolve()
  t.mock.timers.tick(15_000)
  for (let i = 0; i < 12; i++) await Promise.resolve()
  assert.equal(calls, 2)
  t.mock.timers.tick(15_000)
  await checked
  assert.equal(bot.calls.filter(c => c[0] === 'pathfinder.stop').length, 2)
  assert.equal(bot.listenerCount('diggingCompleted'), 0)
})

test('gather_blocks verifies by inventory change and reports partial', async () => {
  const bot = new FakeBot({ blocks: trees })
  bot.hangOnEmptyEquip = true
  const res = await gatherBlocks(ctxFor(bot), { block: 'log', count: 4 })
  assert.equal(res.ok, true)
  assert.equal(res.observations.collected, 4)
  assert.deepEqual(res.observations.items, { oak_log: 3, birch_log: 1 })
  assert.equal(res.summary, 'Collected 3 oak_log, 1 birch_log')
  assert.ok(bot.calls.some(c => c[0] === 'dig'))

  const bot2 = new FakeBot({ blocks: { '2,64,0': 'oak_log' } })
  const partial = await gatherBlocks(ctxFor(bot2), { block: 'oak_log', count: 3 })
  assert.equal(partial.ok, false)
  assert.equal(partial.error.category, 'partial')
  assert.equal(partial.observations.collected, 1)
})

test('gather_blocks skips unreachable blocks and requires the right tool', async () => {
  const bot = new FakeBot({ blocks: { '2,64,0': 'oak_log', '6,64,0': 'oak_log' } })
  bot.unreachable.add('2,64,0')
  const res = await gatherBlocks(ctxFor(bot), { block: 'oak_log', count: 1 })
  assert.equal(res.ok, true)
  assert.equal(res.observations.errors.length, 1)

  const stoneBot = new FakeBot({ blocks: { '2,64,0': 'stone' } })
  const noPick = await gatherBlocks(ctxFor(stoneBot), { block: 'cobblestone', count: 1 })
  assert.equal(noPick.error.category, 'missing_tool')
  assert.ok(noPick.observations.requiresOneOf.includes('wooden_pickaxe'))

  stoneBot.counts.wooden_pickaxe = 1
  const withPick = await gatherBlocks(ctxFor(stoneBot), { block: 'cobblestone', count: 1 })
  assert.equal(withPick.ok, true)
  assert.equal(stoneBot.counts.cobblestone, 1)
})

test('craft_item crafts 2x2 recipes without a table', async () => {
  const bot = new FakeBot({ inventory: { oak_log: 2 } })
  const planks = await craftItem(ctxFor(bot), { item: 'oak_planks', count: 8 })
  assert.equal(planks.ok, true)
  assert.equal(bot.counts.oak_planks, 8)
  const sticks = await craftItem(ctxFor(bot), { item: 'stick', count: 4 })
  assert.equal(sticks.ok, true)
  assert.equal(bot.counts.stick, 4)
  assert.equal(bot.counts.oak_planks, 6)
})

test('gather_blocks restores a harvestable tool after navigation changes the hand', async () => {
  const bot = new FakeBot({ inventory: { iron_pickaxe: 1 }, blocks: { '8,64,0': 'diamond_ore' } })
  const goto = bot.pathfinder.goto
  bot.pathfinder.goto = async goal => { await goto(goal); bot.heldItem = null }
  const dig = bot.dig.bind(bot)
  bot.dig = async block => { assert.equal(block.canHarvest(bot.heldItem?.type ?? null), true); await dig(block) }
  const result = await gatherBlocks(ctxFor(bot), { block: 'diamond', count: 1 })
  assert.equal(result.ok, true)
  assert.equal(bot.counts.diamond, 1)
})

test('craft_item can use a nearby table for a 2x2 recipe', async () => {
  const bot = new FakeBot({ inventory: { oak_log: 1 }, blocks: { '2,64,0': 'crafting_table' } })
  const result = await craftItem(ctxFor(bot), { item: 'oak_planks', count: 4, preferTable: true })
  assert.equal(result.ok, true)
  assert.equal(result.observations.usedTable, true)
  assert.ok(bot.calls.some(c => c[0] === 'craft' && c[1] === 'oak_planks' && c[3] === true))
})

test('craft_item reports missing ingredients for the closest recipe variant', async () => {
  const bot = new FakeBot({ inventory: { birch_planks: 1, stick: 2 } })
  const res = await craftItem(ctxFor(bot), { item: 'wooden_pickaxe' })
  assert.equal(res.ok, false)
  assert.equal(res.error.category, 'missing_materials')
  assert.deepEqual(res.observations.missing, { birch_planks: 2 })
  assert.equal(res.observations.requiresTable, true)
})

test('craft_item needs a station, and places one from inventory', async () => {
  const bot = new FakeBot({ inventory: { oak_planks: 3, stick: 2 } })
  const noTable = await craftItem(ctxFor(bot), { item: 'wooden_pickaxe' })
  assert.equal(noTable.error.category, 'no_station')

  bot.counts.crafting_table = 1
  const res = await craftItem(ctxFor(bot), { item: 'wooden_pickaxe' })
  assert.equal(res.ok, true, res.summary)
  assert.equal(bot.counts.wooden_pickaxe, 1)
  assert.equal(bot.counts.crafting_table, 0)
  assert.ok(res.observations.placedCraftingTable)
})

test('craft_item reports partial when ingredients limit output', async () => {
  const bot = new FakeBot({ inventory: { oak_planks: 2 } })
  const res = await craftItem(ctxFor(bot), { item: 'stick', count: 8 })
  assert.equal(res.error.category, 'partial')
  assert.equal(bot.counts.stick, 4)
  assert.deepEqual(res.observations.consumed, { oak_planks: 2 })
})

test('craft_item selects a recipe from observed ingredients despite an invalid plugin recipe selection', async () => {
  const bot = new FakeBot({ inventory: { spruce_planks: 3, stick: 2 }, blocks: { '2,64,0': 'crafting_table' } })
  bot.recipesFor = id => bot.recipesAll(id).slice(0, 1)
  const result = await craftItem(ctxFor(bot), { item: 'wooden_pickaxe' })
  assert.equal(result.ok, true, result.summary)
  assert.equal(bot.counts.wooden_pickaxe, 1)
  assert.deepEqual(result.observations.recipeIngredients, { spruce_planks: 3, stick: 2 })
  assert.equal(result.observations.crafts, 1)
})

test('craft_item reports observed consumption when the server crafts fewer than requested', async () => {
  const bot = new FakeBot({ inventory: { oak_planks: 4 } })
  const craft = bot.craft.bind(bot)
  let calls = 0
  bot.craft = (recipe, count, table) => ++calls === 1 ? craft(recipe, 1, table) : Promise.resolve()
  const res = await craftItem(ctxFor(bot), { item: 'stick', count: 8 })
  assert.equal(res.error.category, 'partial')
  assert.deepEqual(res.observations.consumed, { oak_planks: 2 })
  assert.equal(res.observations.crafted, 4)
  assert.equal(res.summary.includes('limited by ingredients'), false)
  assert.deepEqual(res.observations.unexpectedOutput, { expected: 4, observed: 0 })
})

test('craft_item rejects unknown items with suggestions', async () => {
  const bot = new FakeBot()
  await assert.rejects(craftItem(ctxFor(bot), { item: 'wood_pickaxe' }), e => e.category === 'invalid_argument' && e.observations.suggestions.includes('wooden_pickaxe'))
})

test('smelt_item validates inputs and fuel, then smelts', async () => {
  const bot = new FakeBot({ inventory: { raw_iron: 3, furnace: 1 } })
  assert.equal((await smeltItem(ctxFor(bot), { item: 'iron_ore', count: 3 })).error.category, 'missing_materials')
  assert.equal((await smeltItem(ctxFor(bot), { item: 'diamond', count: 1 })).error.category, 'invalid_argument')
  assert.equal((await smeltItem(ctxFor(bot), { item: 'raw_iron', count: 3 })).error.category, 'missing_materials') // no fuel
  bot.counts.oak_planks = 2
  const res = await smeltItem(ctxFor(bot), { item: 'raw_iron', count: 3 })
  assert.equal(res.ok, true, res.summary)
  assert.equal(bot.counts.iron_ingot, 3)
  assert.equal(res.observations.fuel, 'oak_planks')
})

test('chooseFuel prefers coal and checks quantity', () => {
  assert.equal(chooseFuel({ coal: 1, oak_planks: 10 }, 'raw_iron', 8).name, 'coal')
  assert.equal(chooseFuel({ coal: 1, oak_planks: 10 }, 'raw_iron', 9).name, 'oak_planks')
  assert.equal(chooseFuel({ oak_log: 1 }, 'oak_log', 1), null)
})

test('equip_item equips named items and armor slots', async () => {
  const bot = new FakeBot({ inventory: { wooden_pickaxe: 1, iron_helmet: 1 } })
  assert.equal((await equipItem(ctxFor(bot), { item: 'wooden_pickaxe' })).ok, true)
  assert.equal(bot.heldItem.name, 'wooden_pickaxe')
  const helm = await equipItem(ctxFor(bot), { item: 'iron_helmet' })
  assert.equal(helm.observations.destination, 'head')
  assert.equal((await equipItem(ctxFor(bot), { item: 'diamond_sword' })).error.category, 'missing_materials')
})

test('place_block places at coordinates and at a free spot', async () => {
  const bot = new FakeBot({ inventory: { cobblestone: 2 } })
  const res = await placeBlock(ctxFor(bot), { item: 'cobblestone', x: 2, y: 64, z: 0 })
  assert.equal(res.ok, true)
  assert.equal(bot.nameAt({ x: 2, y: 64, z: 0 }), 'cobblestone')
  const auto = await placeBlock(ctxFor(bot), { item: 'cobblestone' })
  assert.equal(auto.ok, true)
  await assert.rejects(placeBlock(ctxFor(bot), { item: 'cobblestone' }), e => e.category === 'missing_materials')
})

test('place_block sneaks when placing against an interactive block', async () => {
  const bot = new FakeBot({ inventory: { chest: 1 }, blocks: { '2,64,0': 'crafting_table' } })
  const res = await placeBlock(ctxFor(bot), { item: 'chest', x: 2, y: 65, z: 0 })
  assert.equal(res.ok, true)
  assert.equal(bot.nameAt({ x: 2, y: 65, z: 0 }), 'chest')
  assert.deepEqual(bot.calls.filter(c => c[0] === 'control'), [['control', 'sneak', true], ['control', 'sneak', false]])
})

test('deposit and withdraw move items through the nearest chest', async () => {
  const bot = new FakeBot({ inventory: { cobblestone: 10 }, blocks: { '2,64,2': 'chest' } })
  const dep = await depositItems(ctxFor(bot), { item: 'cobblestone', count: 6 })
  assert.equal(dep.ok, true)
  assert.deepEqual(dep.observations.contents, { cobblestone: 6 })
  assert.equal(bot.counts.cobblestone, 4)
  const wd = await withdrawItems(ctxFor(bot), { item: 'cobblestone' })
  assert.equal(wd.observations.withdrawn, 6)
  assert.equal(bot.counts.cobblestone, 10)
  const originalBlockAt = bot.blockAt.bind(bot)
  bot.blockAt = pos => { assert.equal(typeof pos.floored, 'function'); return originalBlockAt(pos) }
  assert.equal((await depositItems(ctxFor(bot), { item: 'cobblestone', count: 1, x: 2, y: 64, z: 2 })).ok, true)
  assert.equal((await withdrawItems(ctxFor(bot), { item: 'diamond' })).error.category, 'not_found')
  const far = new FakeBot({ inventory: { dirt: 1 } })
  assert.equal((await depositItems(ctxFor(far), { item: 'dirt' })).error.category, 'not_found')
})

test('BotSession wraps results with inventory/position changes', async () => {
  const bot = new FakeBot({ blocks: trees })
  const session = new BotSession({ bot })
  const tool = gameTools.find(t => t.name === 'gather_blocks')
  const res = await session.run('gather_blocks', ctx => tool.handler(ctx, { block: 'oak_log', count: 2 }))
  assert.equal(res.ok, true)
  assert.equal(res.tool, 'gather_blocks')
  assert.deepEqual(res.changes.inventory, { oak_log: 2 })
  assert.equal(res.error, null)
  assert.ok(res.changes.position.from)
})

test('BotSession enforces one action at a time, timeouts and stop', async () => {
  const bot = new FakeBot({ blocks: trees })
  bot.hang = true
  const session = new BotSession({ bot })
  const tool = gameTools.find(t => t.name === 'gather_blocks')
  const running = session.run('gather_blocks', ctx => tool.handler(ctx, { block: 'log', count: 1 }), { timeoutMs: 5_000 })
  await new Promise(resolve => setImmediate(resolve))
  const busy = await session.run('craft_item', async () => ({ ok: true }))
  assert.equal(busy.error.category, 'busy')

  const stopped = session.stop('test')
  assert.equal(stopped.stopped, 'gather_blocks')
  assert.ok(bot.calls.some(c => c[0] === 'collectBlock.cancel'))

  const timed = await session.run('x', () => new Promise(() => {}), { timeoutMs: 20, exclusive: false })
  assert.equal(timed.error.category, 'timeout')
  void running
})

test('BotSession converts thrown ToolErrors and interruption into categories', async () => {
  const session = new BotSession({ bot: new FakeBot() })
  const res = await session.run('t', () => { throw new ToolError(ErrorCategory.NO_STATION, 'no table') })
  assert.equal(res.error.category, 'no_station')
  const res2 = await session.run('t', async (ctx) => { session.stop('user'); ctx.checkAbort() })
  assert.equal(res2.error.category, 'interrupted')
})

test('BotSession reports not_connected when connection fails', async () => {
  const session = new BotSession({ connect: async () => { throw new Error('ECONNREFUSED') } })
  const res = await session.run('observe', async () => ({ ok: true }))
  assert.equal(res.error.category, 'not_connected')
})

test('say refuses slash commands', async () => {
  const bot = new FakeBot()
  const say = gameTools.find(t => t.name === 'say')
  assert.equal((await say.handler(ctxFor(bot), { message: '/give @s diamond 64' })).ok, false)
  assert.equal((await say.handler(ctxFor(bot), { message: 'hi' })).ok, true)
  assert.deepEqual(bot.chatSent, ['hi'])
})
