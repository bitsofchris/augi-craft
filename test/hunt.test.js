import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { huntAnimal } from '../runtime/tools/hunt.js'

function fixture () {
  const bot = new FakeBot({ inventory: { stone_sword: 1 } })
  bot.world = { raycast: () => null }
  bot.pathfinder.movements = { canDig: true, scafoldingBlocks: [1] }
  bot.pathfinder.setMovements = m => { bot.pathfinder.movements = m }
  const target = { id: 7, name: 'sheep', position: new Vec3(1, 64, 0), height: 1.3 }
  bot.entities[7] = target
  bot.attack = e => bot.calls.push(['attack', e.id])
  return { bot, target }
}

test('hunt follows one target, confirms death and verifies collected loot', async () => {
  const { bot, target } = fixture()
  const original = bot.pathfinder.movements
  let hits = 0
  bot.attack = e => {
    assert.equal(e, target)
    assert.equal(bot.pathfinder.movements.canDig, false)
    if (++hits === 3) {
      bot.emit('entityDead', e)
      delete bot.entities[7]
      const loot = { id: 8, name: 'item', position: target.position.clone(), getDroppedItem: () => ({ name: 'white_wool', count: 1 }) }
      bot.entities[8] = loot
      bot.emit('entitySpawn', loot)
    }
  }
  bot.waitForTicks = async () => {
    if (bot.calls.at(-1)?.[1]?.constructor.name === 'GoalNear' && bot.entities[8]) {
      bot.add('white_wool', 1)
      delete bot.entities[8]
    }
  }
  const result = await huntAnimal(ctxFor(bot), { entityId: 7 })
  assert.equal(result.ok, true)
  assert.equal(result.observations.killVerified, true)
  assert.equal(result.observations.attacks, 3)
  assert.deepEqual(result.observations.collected, { white_wool: 1 })
  assert.equal(bot.pathfinder.movements, original)
  assert.equal(bot.listenerCount('entityDead'), 0)
  assert.equal(bot.listenerCount('entitySpawn'), 0)
})

test('hunt never treats five hits or disappearance as a kill', async () => {
  const { bot } = fixture()
  const result = await huntAnimal(ctxFor(bot), { entityId: 7, maxHits: 5 })
  assert.equal(result.ok, false)
  assert.equal(result.observations.attacks, 5)
  assert.equal(result.observations.killVerified, false)
  bot.attack = () => { delete bot.entities[7] }
  const gone = await huntAnimal(ctxFor(bot), { entityId: 7 })
  assert.equal(gone.observations.killVerified, false)
  assert.match(gone.summary, /disappeared/)
})

test('hunt rejects players, pets, named livestock, absent sword and full inventory', async () => {
  for (const change of [e => { e.name = 'wolf' }, e => { e.username = 'Player1' }, e => { e.customName = 'Pet' }]) {
    const { bot, target } = fixture()
    change(target)
    assert.equal((await huntAnimal(ctxFor(bot), { entityId: 7 })).error.category, 'invalid_argument')
    assert.equal(bot.calls.length, 0)
  }
  const { bot } = fixture()
  bot.counts = {}
  assert.equal((await huntAnimal(ctxFor(bot), { entityId: 7 })).error.category, 'missing_tool')
  bot.inventory.emptySlotCount = () => 0
  assert.equal((await huntAnimal(ctxFor(bot), { entityId: 7 })).error.category, 'inventory_full')
})

test('hunt cannot hit through walls or pursue beyond its radius', async () => {
  const { bot, target } = fixture()
  bot.world.raycast = () => ({ name: 'stone' })
  assert.equal((await huntAnimal(ctxFor(bot), { entityId: 7 })).observations.attacks, 0)
  target.position.x = 40
  assert.equal((await huntAnimal(ctxFor(bot), { entityId: 7 })).error.category, 'unreachable')
})

test('cancellation during pursuit clears movement and listeners', async () => {
  const { bot } = fixture()
  const original = bot.pathfinder.movements
  const ctx = ctxFor(bot)
  bot.waitForTicks = async () => { ctx.signal.aborted = true }
  await assert.rejects(huntAnimal(ctx, { entityId: 7 }), /interrupted/)
  assert.equal(bot.pathfinder.movements, original)
  assert.equal(bot.listenerCount('entityDead'), 0)
  assert.equal(bot.listenerCount('entitySpawn'), 0)
  assert.deepEqual(bot.calls.at(-1), ['clearControlStates'])
})

test('named metadata and changed identity cannot be attacked', async () => {
  const { bot, target } = fixture()
  const index = bot.registry.entitiesByName.sheep.metadataKeys.indexOf('custom_name')
  target.metadata = { [index]: { text: 'Dolly' } }
  assert.equal((await huntAnimal(ctxFor(bot), { entityId: 7 })).error.category, 'invalid_argument')
  target.metadata = {}
  bot.lookAt = async () => { target.name = 'wolf' }
  const result = await huntAnimal(ctxFor(bot), { entityId: 7 })
  assert.equal(result.observations.attacks, 0)
})

test('low health keeps hunting; disconnect cancellation stops pursuit safely', async () => {
  const { bot } = fixture()
  bot.health = 10; bot.food = 4
  assert.ok((await huntAnimal(ctxFor(bot), { entityId: 7 })).observations.attacks > 0)
  bot.health = 20
  const ctx = ctxFor(bot)
  bot.waitForTicks = async () => { ctx.signal.aborted = true; delete bot.entities[7] }
  await assert.rejects(huntAnimal(ctx, { entityId: 7 }), /interrupted/)
  assert.equal(bot.listenerCount('entityDead'), 0)
})

test('pickup waits for late item metadata and follows falling cooked loot', async () => {
  const { bot, target } = fixture()
  let ticks = 0
  const loot = { id: 8, name: 'item', position: new Vec3(1, 65, 0), getDroppedItem: () => ticks >= 15 ? { name: 'cooked_mutton', count: 2 } : null }
  bot.attack = () => {
    bot.emit('entityHurt', target)
    bot.emit('entityDead', target)
    delete bot.entities[7]
    bot.entities[8] = loot
    bot.emit('entitySpawn', loot)
  }
  bot.waitForTicks = async () => {
    ticks++
    if (ticks === 18) loot.position.y = 64
    const goal = bot.calls.filter(c => c[0] === 'setGoal').at(-1)?.[1]
    if (bot.entities[8] && goal?.constructor.name === 'GoalNear' && goal.y === 64) {
      bot.add('cooked_mutton', 2); delete bot.entities[8]
    }
  }
  const result = await huntAnimal(ctxFor(bot), { entityId: 7 })
  assert.equal(result.ok, true)
  assert.equal(result.observations.damageEvents, 1)
  assert.equal(result.observations.collectionVerified, true)
  assert.deepEqual(result.observations.collected, { cooked_mutton: 2 })
  assert.equal(bot.listenerCount('entityHurt'), 0)
})

test('kill without collected loot and partially collected drops stay partial', async () => {
  for (const collected of [false, true]) {
    const { bot, target } = fixture()
    bot.attack = () => {
      bot.emit('entityDead', target); delete bot.entities[7]
      const loot = { id: 8, name: 'item', position: target.position.clone(), getDroppedItem: () => ({ name: 'white_wool', count: 1 }) }
      bot.entities[8] = loot; bot.emit('entitySpawn', loot)
      if (collected) bot.add('mutton', 1)
    }
    const result = await huntAnimal(ctxFor(bot), { entityId: 7 })
    assert.equal(result.ok, false)
    assert.equal(result.error.category, 'partial')
    assert.equal(result.observations.killVerified, true)
    assert.equal(result.observations.remainingDrops, 1)
  }
})

test('unreachable pursuit is bounded and pickup cancellation restores state', async () => {
  const { bot, target } = fixture()
  target.position.x = 12
  const stuck = await huntAnimal(ctxFor(bot), { entityId: 7 })
  assert.equal(stuck.error.category, 'unreachable')
  assert.equal(stuck.observations.attacks, 0)
  target.position.x = 1
  const ctx = ctxFor(bot)
  bot.attack = () => { bot.emit('entityDead', target); delete bot.entities[7] }
  bot.waitForTicks = async () => { ctx.signal.aborted = true }
  await assert.rejects(huntAnimal(ctx, { entityId: 7 }), /interrupted/)
  for (const event of ['entityDead', 'entitySpawn', 'entityHurt']) assert.equal(bot.listenerCount(event), 0)
})
