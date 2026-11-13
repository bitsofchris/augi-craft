import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { bowTrajectory, shootBow } from '../runtime/tools/bow.js'

function fixture () {
  const bot = new FakeBot({ inventory: { bow: 1, arrow: 5 }, blocks: { '10,65,0': 'stone' } })
  bot.world.raycast = () => null
  bot.activateItem = () => bot.calls.push(['draw'])
  bot.deactivateItem = () => { bot.calls.push(['release', bot.heldItem?.name]); if (bot.heldItem?.name === 'bow') bot.add('arrow', -1) }
  bot.unequip = async () => { bot.calls.push(['unequip']); bot.heldItem = null }
  return bot
}

test('bow solver compensates gravity and bounds range', () => {
  const eye = new Vec3(0, 65.62, 0)
  const plan = bowTrajectory(eye, new Vec3(20, 65.62, 0))
  assert.ok(plan.direction.y > 0)
  assert.ok(Math.abs(plan.points.at(-1).y - 65.62) < .001)
  assert.equal(bowTrajectory(eye, new Vec3(30, 65.62, 0)), null)
})

test('bow consumes one real arrow and does not claim unobserved impact', async () => {
  const bot = fixture()
  const result = await shootBow(ctxFor(bot), { x: 10, y: 65, z: 0 })
  assert.equal(result.ok, true)
  assert.equal(result.observations.arrowsUsed, 1)
  assert.equal(result.observations.hitConfirmed, false)
  assert.equal(bot.listenerCount('entitySpawn'), 0)
})

test('bow refuses players, blocked arcs, and a friendly crossing during draw', async () => {
  const bot = fixture()
  bot.entities[7] = { id: 7, name: 'player', username: 'Child', position: new Vec3(10, 64, 0) }
  assert.equal((await shootBow(ctxFor(bot), { entityId: 7 })).error.category, 'invalid_argument')
  delete bot.entities[7]
  bot.world.raycast = () => ({ name: 'stone', position: new Vec3(3, 65, 0) })
  assert.equal((await shootBow(ctxFor(bot), { x: 10, y: 65, z: 0 })).error.category, 'unreachable')
  bot.world.raycast = () => null
  bot.waitForTicks = async () => { bot.entities[8] = { id: 8, type: 'player', position: new Vec3(5, 64, 0) } }
  assert.equal((await shootBow(ctxFor(bot), { x: 10, y: 65, z: 0 })).error.category, 'unreachable')
  assert.equal(bot.counts.arrow, 5)
  assert.equal(bot.calls.some(c => c[0] === 'release' && c[1] === 'bow'), false)
})

test('cancelling a drawn bow unequips before release and cleans listeners', async () => {
  const bot = fixture()
  const ctx = ctxFor(bot)
  bot.waitForTicks = async () => { ctx.signal.aborted = true }
  await assert.rejects(shootBow(ctx, { x: 10, y: 65, z: 0 }), /interrupted/)
  assert.equal(bot.counts.arrow, 5)
  assert.deepEqual(bot.calls.slice(-2), [['unequip'], ['release', undefined]])
  assert.equal(bot.listenerCount('entityHurt'), 0)
})
