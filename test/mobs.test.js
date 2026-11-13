import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { scanMobs } from '../runtime/tools/mobs.js'
import { gameTools } from '../runtime/tools/index.js'

test('mob scan reports tracked eligible targets and actual difficulty without side effects', async () => {
  const bot = new FakeBot(); bot.game.difficulty = 'easy'
  const mob = (id, name, x, extra = {}) => ({ id, name, position: new Vec3(x,64,0), ...extra })
  bot.entities = { 1: mob(1,'spider',24), 2: mob(2,'cave_spider',4), 3: mob(3,'spider',65), 4: mob(4,'spider',2,{customName:'Pet'}), 5: mob(5,'player',1,{username:'Player1'}), 6: mob(6,'zombie',6), 7: mob(7,'spider',3,{isValid:false}) }
  assert.equal(gameTools.find(t=>t.name==='scan_mobs').handler, scanMobs)
  const result = await scanMobs(ctxFor(bot), {})
  assert.equal(result.observations.difficulty,'easy')
  assert.deepEqual(result.observations.targets.map(t=>t.entityId),[2,1])
  assert.deepEqual((await scanMobs(ctxFor(bot),{mob:'hostile'})).observations.targets.map(t=>t.entityId),[2,6,1])
  assert.deepEqual(bot.calls,[])
})
test('mob scan handles no targets, unknown difficulty, invalid filters and cancellation', async () => {
  const bot = new FakeBot();const ctx=ctxFor(bot)
  assert.equal((await scanMobs(ctx,{})).observations.difficulty,null)
  assert.deepEqual((await scanMobs(ctx,{})).observations.targets,[])
  for(const args of [{radius:65},{radius:0},{mob:'player'}]) assert.equal((await scanMobs(ctx,args)).error.category,'invalid_argument')
  ctx.signal.aborted=true
  await assert.rejects(scanMobs(ctx,{}),/interrupted/)
  assert.deepEqual(bot.calls,[])
})

test('difficulty compatibility handles mapped26.3 names and older numeric values after upstream listeners', async () => {
  const { EventEmitter } = await import('node:events')
  const { normalizeDifficulty, installDifficultyCompatibility } = await import('../runtime/bot/difficulty-compat.js')
  const bot = { _client: new EventEmitter(), game: {} }
  installDifficultyCompatibility(bot)
  installDifficultyCompatibility(bot)
  bot._client.on('difficulty', () => { bot.game.difficulty = undefined })
  for (const [raw, expected] of [['peaceful','peaceful'],['normal','normal'],[0,'peaceful'],[1,'easy'],[3,'hard']]) {
    bot._client.emit('difficulty', { difficulty: raw })
    await Promise.resolve()
    assert.equal(bot.game.difficulty, expected)
  }
  assert.equal(bot._client.listenerCount('difficulty'),2)
  for (const invalid of [4,-1,'bogus',null,undefined]) assert.equal(normalizeDifficulty(invalid),null)
})
