import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { BotSession } from '../runtime/bot/session.js'
import { shelter, isNight, isCovered } from '../runtime/tools/shelter.js'
import { playerNearby } from '../runtime/bot/self-defense.js'
import { defensePolicyFromEnv } from '../runtime/mcp/augi.js'
import { Vec3 } from 'vec3'

test('shelter digs three down and seals above the head', async () => {
  const bot = new FakeBot({ inventory: { dirt: 2 } })
  bot.waitForTicks = async () => { bot.entity.position.y = 61 }
  const res = await shelter(ctxFor(bot))
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(res.observations.dug, 3)
  assert.equal(bot.nameAt({ x: 0, y: 63, z: 0 }), 'dirt')
  assert.equal(bot.nameAt({ x: 0, y: 62, z: 0 }), 'air')
  assert.equal(isCovered(bot), true)
})

test('shelter never seals with sand or gravel, which would fall on the head', async () => {
  const bot = new FakeBot({ inventory: { sand: 12, gravel: 3, dirt: 1 } })
  bot.waitForTicks = async () => { bot.entity.position.y = 61 }
  const res = await shelter(ctxFor(bot))
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(bot.nameAt({ x: 0, y: 63, z: 0 }), 'dirt')
})

test('shelter refuses next to lava and is a no-op under cover', async () => {
  const lava = new FakeBot({ blocks: { '1,62,0': 'lava' } })
  assert.equal((await shelter(ctxFor(lava))).error.category, 'unreachable')
  const roofed = new FakeBot({ blocks: { '0,67,0': 'stone' } })
  const res = await shelter(ctxFor(roofed))
  assert.equal(res.summary, 'Already under cover')
  assert.equal(roofed.calls.some(c => c[0] === 'dig'), false)
})

test('night detection follows the Minecraft clock', () => {
  const bot = new FakeBot()
  bot.time.timeOfDay = 18000
  assert.equal(isNight(bot), true)
  bot.time.timeOfDay = 1000
  assert.equal(isNight(bot), false)
})

test('the night reflex shelters a bot that respawns at night', async () => {
  const bot = new FakeBot({ inventory: { dirt: 2 } })
  bot.health = 20
  bot.time.timeOfDay = 18000
  bot.unequip = async () => {}
  bot.world.raycast = () => null
  bot.waitForTicks = async () => { bot.entity.position.y = 61 }
  const session = new BotSession({ bot, defensePolicy: { mode: 'local-defense' } })
  bot.emit('spawn')
  await new Promise(r => setTimeout(r, 1700))
  const ev = session.inbox.find(e => e.type === 'sheltered')
  assert.ok(ev, JSON.stringify(session.inbox))
  assert.equal(ev.ok, true)
  bot.emit('end')
})

function nightBot () {
  const bot = new FakeBot({ inventory: { dirt: 2 } })
  bot.health = 20
  bot.time.timeOfDay = 18000
  bot.unequip = async () => {}
  bot.world.raycast = () => null
  bot.waitForTicks = async () => { bot.entity.position.y = 61 }
  return bot
}
const respawnAndWait = async (bot, session) => {
  bot.emit('spawn')
  await new Promise(r => setTimeout(r, 1700))
  bot.emit('end')
  return session.inbox.find(e => e.type === 'sheltered')
}

test('no night shelter when the worker policy turns it off (guards)', async () => {
  const bot = nightBot()
  const session = new BotSession({ bot, defensePolicy: { mode: 'local-defense', nightShelter: false } })
  assert.equal(await respawnAndWait(bot, session), undefined)
  assert.equal(bot.calls.some(c => c[0] === 'dig'), false)
})

test('no night shelter while any person is online, even far away, or while a job waits to resume', async () => {
  const bot = nightBot()
  bot.players = { '.Kid1': { username: '.Kid1' } } // online, out of sight
  const session = new BotSession({ bot, defensePolicy: { mode: 'local-defense' } })
  assert.equal(await respawnAndWait(bot, session), undefined)
  assert.equal(bot.calls.some(c => c[0] === 'dig'), false)

  const crewOnly = nightBot()
  crewOnly.players = { AugiMiner: { username: 'AugiMiner', entity: { position: new Vec3(5, 64, 0) } }, Guard: { username: 'Guard' }, AugiEars: { username: 'AugiEars' } }
  assert.equal(playerNearby(crewOnly, 16), false, 'other bots do not count as players')
  const ev = await respawnAndWait(crewOnly, new BotSession({ bot: crewOnly, defensePolicy: { mode: 'local-defense' } }))
  assert.equal(ev?.ok, true, 'with only bots online the reflex still shelters')

  const busy = nightBot()
  const s2 = new BotSession({ bot: busy, defensePolicy: { mode: 'local-defense' } })
  s2.resumePending = 1
  assert.equal(await respawnAndWait(busy, s2), undefined)
})

test('AUGI_NIGHT_SHELTER turns the night reflex off per worker', () => {
  assert.deepEqual(defensePolicyFromEnv({ mode: 'local-defense' }, { AUGI_NIGHT_SHELTER: 'false' }), { mode: 'local-defense', nightShelter: false })
  assert.deepEqual(defensePolicyFromEnv(null, { AUGI_NIGHT_SHELTER: 'true' }), { nightShelter: true })
  assert.equal(defensePolicyFromEnv(null, {}), null)
})
