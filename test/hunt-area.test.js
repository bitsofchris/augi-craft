import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { huntArea } from '../runtime/tools/hunt-area.js'
import { attackMob } from '../runtime/tools/hunt.js'

function fixture () {
  const bot = new FakeBot({ inventory: { stone_sword: 1 } })
  bot.world = { raycast: () => null }
  bot.pathfinder.movements = { canDig: true }
  bot.pathfinder.setMovements = m => { bot.pathfinder.movements = m }
  return bot
}

test('patrol notices an animal during movement and completes combat without observe calls', async () => {
  const bot = fixture()
  const original = bot.pathfinder.movements
  let ticks = 0; let hits = 0
  bot.waitForTicks = async () => {
    if (++ticks === 3) bot.entities[7] = { id: 7, name: 'sheep', height: 1.3, position: new Vec3(1, 64, 0) }
  }
  bot.attack = e => {
    if (++hits === 7) {
      bot.emit('entityDead', e)
      delete bot.entities[7]
      bot.add('white_wool', 1)
    }
  }
  const result = await huntArea(ctxFor(bot), { maxKills: 1, seconds: 5 })
  assert.equal(result.ok, true)
  assert.equal(hits, 7)
  assert.deepEqual(result.observations.collected, { white_wool: 1 })
  assert.equal(result.observations.kills, 1)
  assert.equal(bot.pathfinder.movements, original)
  assert.equal(bot.listenerCount('entityDead'), 0)
})

test('patrol ignores other species, stops cleanly on cancellation, keeps going when hurt', async () => {
  const bot = fixture()
  bot.entities[7] = { id: 7, name: 'pig', position: new Vec3(1, 64, 0) }
  bot.attack = () => assert.fail('Must not hunt pigs on a sheep task')
  const ctx = ctxFor(bot)
  const original = bot.pathfinder.movements
  bot.waitForTicks = async () => { ctx.signal.aborted = true }
  await assert.rejects(huntArea(ctx, { animal: 'sheep', seconds: 5 }), /interrupted/)
  assert.equal(bot.pathfinder.movements, original)
  ctx.signal.aborted = false
  bot.health = 10
  assert.notEqual((await huntArea(ctx, { seconds: 1 })).summary, 'Hunt stopped for low health or food')
})

test('any patrol hunts mixed livestock, prioritizes nearest, and excludes pets and players', async () => {
  for (const selection of [{ animal: 'any' }, {}]) {
    const bot = fixture()
    bot.entities = {
      1: { id: 1, name: 'wolf', position: new Vec3(0.1, 64, 0) },
      2: { id: 2, name: 'sheep', customName: 'Pet', position: new Vec3(0.2, 64, 0) },
      3: { id: 3, name: 'pig', username: 'Player', position: new Vec3(0.3, 64, 0) },
      7: { id: 7, name: 'pig', height: 1, position: new Vec3(1, 64, 0) },
      8: { id: 8, name: 'sheep', height: 1.3, position: new Vec3(2, 64, 0) }
    }
    const attacked = []
    bot.attack = e => {
      attacked.push(e.id)
      bot.emit('entityDead', e)
      delete bot.entities[e.id]
      bot.add(e.name === 'pig' ? 'porkchop' : 'white_wool', 1)
    }
    const result = await huntArea(ctxFor(bot), { ...selection, maxKills: 2, seconds: 5 })
    assert.deepEqual(attacked, [7, 8])
    assert.equal(result.observations.kills, 2)
    assert.deepEqual(result.observations.collected, { porkchop: 1, white_wool: 1 })
  }
})

test('hostile combat accepts zombie, rejects livestock and confirms death', async () => {
  const bot = fixture()
  const target = { id: 7, name: 'zombie', height: 1.8, position: new Vec3(1, 64, 0) }
  bot.entities[7] = target
  bot.attack = e => { bot.emit('entityDead', e); delete bot.entities[7]; bot.add('rotten_flesh', 1) }
  const result = await attackMob(ctxFor(bot), { entityId: 7 })
  assert.equal(result.observations.killVerified, true)
  assert.deepEqual(result.observations.collected, { rotten_flesh: 1 })
  target.name = 'sheep'
  bot.entities[7] = target
  assert.equal((await attackMob(ctxFor(bot), { entityId: 7 })).error.category, 'invalid_argument')
})

test('patrol stops to report a kill whose drops remain uncollected', async () => {
  const bot = fixture()
  const target = { id: 7, name: 'cow', position: new Vec3(1, 64, 0) }
  bot.entities[7] = target
  bot.attack = () => { bot.emit('entityDead', target); delete bot.entities[7] }
  const result = await huntArea(ctxFor(bot), { maxKills: 2, seconds: 5 })
  assert.equal(result.error.category, 'partial')
  assert.equal(result.observations.animal, 'any')
  assert.equal(result.observations.kills, 1)
  assert.equal(result.observations.encounters[0].observations.collectionVerified, false)
})

test('invalid patrol bounds are rejected before movement', async () => {
  const bot = fixture()
  for (const args of [{ seconds: 0 }, { radius: 100 }, { maxKills: 20 }]) {
    assert.equal((await huntArea(ctxFor(bot), args)).error.category, 'invalid_argument')
  }
  assert.deepEqual(bot.calls, [])
})

test('patrol advances immediately on arrival instead of waiting five seconds at each waypoint', async () => {
  const bot = fixture()
  bot.waitForTicks = async () => {
    const goal = bot.calls.filter(c => c[0] === 'setGoal').at(-1)?.[1]
    if (goal) bot.entity.position = new Vec3(goal.x, 64, goal.z)
  }
  const result = await huntArea(ctxFor(bot), { radius: 32, seconds: 5 })
  assert.equal(result.observations.kills, 0)
  assert.ok(result.observations.waypoints > 10)
  assert.equal(result.observations.scans, 100)
})
