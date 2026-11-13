import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { shearSheep, attackAnimal } from '../runtime/tools/animals.js'

function fixture (name = 'sheep', inventory = { shears: 1 }) {
  const bot = new FakeBot({ inventory })
  const woolIndex = bot.registry.entitiesByName.sheep.metadataKeys.indexOf('wool')
  bot.entities[7] = { id: 7, name, position: new Vec3(1, 64, 0), height: 1.3, metadata: { [woolIndex]: 0 } }
  bot.world = { raycast: () => null }
  bot.activateEntity = async entity => { bot.calls.push(['shear', entity.id]); entity.metadata[woolIndex] = 16 }
  bot.attack = entity => bot.calls.push(['attack', entity.id])
  return bot
}

test('shearing confirms state and refuses already sheared sheep', async () => {
  const bot = fixture()
  assert.equal((await shearSheep(ctxFor(bot), { entityId: 7 })).observations.sheared, true)
  assert.equal((await shearSheep(ctxFor(bot), { entityId: 7 })).error.category, 'not_found')
  assert.equal(bot.calls.filter(c => c[0] === 'shear').length, 1)
})

test('shearing verifies wool pickup without metadata and does not invent success', async () => {
  const bot = fixture()
  bot.entities[7].metadata = {}
  bot.activateEntity = async () => { bot.add('white_wool', 2) }
  assert.equal((await shearSheep(ctxFor(bot), { entityId: 7 })).observations.collected, 2)
  bot.activateEntity = async () => {}
  assert.equal((await shearSheep(ctxFor(bot), { entityId: 7 })).error.category, 'timeout')
})

test('animal actions reject players, pets, walls, distance and missing tools', async () => {
  for (const name of ['player', 'wolf', 'cat', 'villager']) {
    const bot = fixture(name)
    assert.equal((await attackAnimal(ctxFor(bot), { entityId: 7 })).error.category, 'invalid_argument')
    assert.equal(bot.calls.length, 0)
  }
  for (const mode of ['wall', 'far']) {
    const bot = fixture()
    if (mode === 'wall') bot.world.raycast = () => ({ name: 'stone' })
    else bot.entities[7].position.x = 20
    assert.equal((await attackAnimal(ctxFor(bot), { entityId: 7 })).error.category, 'unreachable')
    assert.equal((await shearSheep(ctxFor(bot), { entityId: 7 })).error.category, 'unreachable')
    assert.equal(bot.calls.length, 0)
  }
  assert.equal((await shearSheep(ctxFor(fixture('sheep', {})), { entityId: 7 })).error.category, 'missing_tool')
})

test('attack sends one hit without claiming a kill; cancellation prevents actions', async () => {
  const bot = fixture()
  const result = await attackAnimal(ctxFor(bot), { entityId: 7 })
  assert.equal(result.observations.killVerified, false)
  assert.deepEqual(bot.calls, [['attack', 7]])
  for (const handler of [shearSheep, attackAnimal]) {
    const other = fixture()
    const ctx = ctxFor(other)
    ctx.signal.aborted = true
    await assert.rejects(handler(ctx, { entityId: 7 }), /interrupted/)
    assert.equal(other.calls.length, 0)
  }
})
