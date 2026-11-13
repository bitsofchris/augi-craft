import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { guardPlayer, followingPosition } from '../runtime/tools/bodyguard.js'
import { inspectContainer } from '../runtime/tools/inventory.js'
import { craftItem } from '../runtime/tools/craft.js'

function fixture () {
  const bot = new FakeBot({ inventory: { stone_sword: 1 }, position: [0, 64, 5] })
  bot.entity.id = 1
  const player = { id: 2, username: 'Player1', type: 'player', position: new Vec3(0, 64, 0), yaw: 0 }
  const zombie = { id: 3, name: 'zombie', position: new Vec3(1, 64, 4), height: 1.8 }
  bot.players = { Player1: { username: 'Player1', entity: player } }
  bot.entities = { 1: bot.entity, 2: player, 3: zombie }
  bot.world = { raycast: () => null }
  bot.attack = e => bot.calls.push(['attack', e.id])
  return { bot, player, zombie }
}

test('guard holds five blocks behind and never initiates against a nearby mob', async () => {
  const { bot, player } = fixture()
  const original = bot.pathfinder.movements
  assert.deepEqual(followingPosition(player, 5), new Vec3(0, 64, 5))
  const result = await guardPlayer(ctxFor(bot), { username: 'Player1', seconds: 1 })
  assert.equal(result.ok, true)
  assert.equal(result.observations.meleeAttacks, 0)
  assert.equal(bot.pathfinder.movements, original)
  assert.equal(bot.listenerCount('entityHurt'), 0)
})

test('guard assists an attributed player attack or defends against an attributed mob attack', async () => {
  for (const assisting of [false, true]) {
    const { bot, player, zombie } = fixture()
    let tick = 0
    bot.waitForTicks = async () => {
      if (++tick === 1) bot.emit('entityHurt', assisting ? zombie : player, assisting ? player : zombie)
    }
    const result = await guardPlayer(ctxFor(bot), { username: 'Player1', seconds: 2 })
    assert.equal(result.observations.meleeAttacks, 2)
    assert.deepEqual(bot.calls.filter(c => c[0] === 'attack'), [['attack', 3], ['attack', 3]])
  }
})

test('guard ignores PvP, unknown attacker, livestock and distant escaping hostiles', async () => {
  for (const mode of ['player', 'unknown', 'sheep', 'far']) {
    const { bot, player, zombie } = fixture()
    if (mode === 'player') zombie.username = 'Other child'
    if (mode === 'sheep') zombie.name = 'sheep'
    if (mode === 'far') zombie.position.x = 20
    let tick = 0
    bot.waitForTicks = async () => { if (++tick === 1) bot.emit('entityHurt', player, mode === 'unknown' ? undefined : zombie) }
    assert.equal((await guardPlayer(ctxFor(bot), { username: 'Player1', seconds: 1 })).observations.meleeAttacks, 0)
  }
})

test('follow updates when player moves, stays nondestructive and halts on disconnect', async () => {
  const { bot, player } = fixture()
  const original = bot.pathfinder.movements
  let tick = 0
  bot.waitForTicks = async () => {
    assert.equal(bot.pathfinder.movements.canDig, false)
    if (++tick === 1) player.position.x = 4
    if (tick === 3) bot.players.Player1.entity = null
  }
  const result = await guardPlayer(ctxFor(bot), { username: 'Player1', seconds: 2 })
  assert.equal(result.error.category, 'partial')
  assert.ok(bot.calls.some(c => c[0] === 'setGoal' && c[1]?.x === 4))
  assert.equal(bot.pathfinder.movements, original)
})

test('guard respects wall obstruction and clears all state on cancellation', async () => {
  const { bot, player, zombie } = fixture()
  bot.world.raycast = () => ({ name: 'stone' })
  const ctx = ctxFor(bot)
  let tick = 0
  bot.waitForTicks = async () => {
    bot.emit('entityHurt', player, zombie)
    if (++tick === 3) ctx.signal.aborted = true
  }
  await assert.rejects(guardPlayer(ctx, { username: 'Player1', seconds: 3 }), /interrupted/)
  assert.equal(bot.calls.filter(c => c[0] === 'attack').length, 0)
  assert.equal(bot.listenerCount('entityHurt'), 0)
  assert.equal(bot.listenerCount('entityDead'), 0)
  assert.deepEqual(bot.calls.at(-1), ['clearControlStates'])
})

test('guard refuses missing sword or offline player but keeps guarding when hurt', async () => {
  const { bot } = fixture()
  assert.equal((await guardPlayer(ctxFor(bot), { username: 'Offline' })).error.category, 'not_found')
  bot.counts = {}
  assert.equal((await guardPlayer(ctxFor(bot), { username: 'Player1' })).error.category, 'missing_tool')
  bot.counts = { stone_sword: 1 }; bot.health = 8; bot.food = 5
  const res = await guardPlayer(ctxFor(bot), { username: 'Player1', seconds: 1 })
  assert.notEqual(res.summary, 'Low health or food; bodyguard stopped safely')
  assert.equal(bot.listenerCount('entityHurt'), 0)
})

test('bodyguard can inspect supply chest without consuming or taking its gear', async () => {
  const bot = new FakeBot({ blocks: { '1,64,0': 'chest' } })
  bot.chests.set('1,64,0', { iron_sword: 1, bow: 1, arrow: 16 })
  const result = await inspectContainer(ctxFor(bot), { x: 1, y: 64, z: 0 })
  assert.deepEqual(result.observations.contents, { iron_sword: 1, bow: 1, arrow: 16 })
  assert.deepEqual(bot.counts, {})
  assert.equal(bot.chests.get('1,64,0').arrow, 16)
})

test('bodyguard gear recipes craft sword, bow and ammunition from real ingredients', async () => {
  const bot = new FakeBot({ inventory: { iron_ingot: 2, stick: 6, string: 3, flint: 1, feather: 1 }, blocks: { '1,64,0': 'crafting_table' } })
  for (const [item, count] of [['iron_sword', 1], ['bow', 1], ['arrow', 4]]) {
    assert.equal((await craftItem(ctxFor(bot), { item, count })).ok, true)
    assert.equal(bot.counts[item], count)
  }
  assert.equal(bot.counts.iron_ingot, 0)
  assert.equal(bot.counts.string, 0)
})

test('guard switches to bow for an attributed distant threat and returns to sword', async () => {
  const { bot, player, zombie } = fixture()
  zombie.position = new Vec3(8, 64, 0)
  bot.counts.bow = 1; bot.counts.arrow = 2
  bot.activateItem = () => {}
  bot.deactivateItem = () => { if (bot.heldItem?.name === 'bow') bot.add('arrow', -1) }
  bot.unequip = async () => { bot.heldItem = null }
  let tick = 0
  bot.waitForTicks = async () => { if (++tick === 1) bot.emit('entityHurt', player, zombie) }
  const result = await guardPlayer(ctxFor(bot), { username: 'Player1', seconds: 5 })
  assert.equal(result.observations.arrowsFired, 2)
  assert.equal(bot.heldItem.name, 'stone_sword')
})
