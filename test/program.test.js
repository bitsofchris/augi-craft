import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FakeBot } from './helpers/fake-bot.js'
import { createAugi } from '../runtime/mcp/augi.js'
import { attackRefusal, chatRefusal } from '../runtime/program/safety.js'
import { helperName, serialize } from '../runtime/program/runner.js'

const here = path.dirname(fileURLToPath(import.meta.url))

function tempKnowledge () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-prog-'))
  fs.cpSync(path.join(here, '..', 'knowledge', 'seeds'), path.join(dir, 'seeds'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'core'), { recursive: true })
  return dir
}

function augi (bot = new FakeBot({ inventory: { oak_log: 2 } })) {
  return createAugi({ knowledgeDir: tempKnowledge(), bot, config: { packs: ['basic'] } })
}

const run = (a, code, extra = {}) => a.tool('run_program').run({ code, ...extra })

test('a program returns values, logs, and the tool envelope', async () => {
  const a = augi()
  const res = await run(a, "log('logs:', bot.inventory.items().length)\nreturn { pos: bot.entity.position, n: args.n }", { args: { n: 3 } })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(res.tool, 'run_program')
  assert.deepEqual(res.observations.logs, ['logs: 1'])
  assert.deepEqual(res.observations.returned, { pos: { x: 0, y: 64, z: 0 }, n: 3 })
  assert.equal(res.observations.health, 20)
  assert.deepEqual(res.changes.inventory, {})
})

test('program errors report the message and the program line', async () => {
  const a = augi()
  const res = await run(a, 'const x = 1\nlog(x)\nthrow new Error("boom")')
  assert.equal(res.ok, false)
  assert.equal(res.error.message, 'boom')
  assert.equal(res.observations.line, 3)
  assert.deepEqual(res.observations.logs, ['1'])
  const bad = await run(a, 'return (')
  assert.equal(bad.error.category, 'invalid_argument')
  assert.match(bad.summary, /does not compile/)
})

test('timeout stops a looping program and releases the lock', async () => {
  const a = augi()
  const res = await run(a, 'while (true) { await sleep(20) }', { timeoutSeconds: 1 })
  assert.equal(res.ok, false)
  assert.equal(res.error.category, 'timeout')
  assert.equal(a.session.current, null)
  const next = await run(a, 'return 1')
  assert.equal(next.ok, true)
})

test('a program that ignores the signal still releases the lock and its timers stop', async () => {
  const a = augi()
  const res = await a.tool('run_program').run({ code: "globalThis.ticks = 0\nsetInterval(() => { globalThis.ticks++ }, 10)\nawait new Promise(() => {})", background: true })
  assert.equal(res.jobId, 'job-1')
  await new Promise(r => setTimeout(r, 60))
  assert.equal(a.session.current?.tool, 'run_program')
  await a.tool('stop_action').run({})
  const done = await a.tool('job_status').run({ jobId: 'job-1' })
  await new Promise(r => setTimeout(r, 20))
  assert.equal(a.session.current, null)
  const after = await run(a, 'return globalThis.ticks')
  await new Promise(r => setTimeout(r, 50))
  const later = await run(a, 'return globalThis.ticks')
  assert.equal(after.observations.returned, later.observations.returned, 'interval stopped with the program')
  assert.ok(['failed', 'running'].includes(done.status))
})

test('program listeners added with lib.on are removed when the program ends', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  const before = bot.listenerCount('entityHurt')
  const res = await run(a, "lib.on('entityHurt', () => {})\nreturn bot.listenerCount('entityHurt')")
  assert.equal(res.observations.returned, before + 1)
  assert.equal(bot.listenerCount('entityHurt'), before)
})

test('programs have no require, process, eval or dynamic import, and globalThis persists', async () => {
  const a = augi()
  const res = await run(a, "return [typeof require, typeof process, typeof module]")
  assert.deepEqual(res.observations.returned, ['undefined', 'undefined', 'undefined'])
  assert.equal((await run(a, "return eval('1 + 1')")).ok, false)
  assert.equal((await run(a, "return new Function('return 1')()")).ok, false)
  assert.equal((await run(a, "await import('node:fs')")).ok, false)
  await run(a, 'globalThis.base = { x: 5 }')
  assert.deepEqual((await run(a, 'return globalThis.base')).observations.returned, { x: 5 })
})

test('lib actions run the tested handlers and validate arguments', async () => {
  const bot = new FakeBot({ blocks: { '3,64,0': 'oak_log', '3,65,0': 'oak_log' } })
  const a = augi(bot)
  const res = await run(a, "const r = await lib.gather_blocks({ block: 'log', count: 2 })\nconst bad = await lib.craft_item({ itm: 'stick' })\nreturn { ok: r.ok, bad: bad.error.category }")
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.deepEqual(res.observations.returned, { ok: true, bad: 'invalid_argument' })
  assert.equal(res.changes.inventory.oak_log, 2)
  const libList = await a.tool('list_lib').run({})
  assert.ok(libList.lib.some(e => e.name === 'navigate_to' && e.args.includes('walkOnly')))
})

test('saved helpers are callable from programs and report usage', async () => {
  const a = augi()
  const saved = await a.tool('save_helper').run({ title: 'Count items', description: 'Count one item type in the bot inventory', code: "return bot.inventory.items().filter(i => i.name === args.item).reduce((n, i) => n + i.count, 0)", args: '{ item }', tags: ['shared'] })
  assert.equal(saved.ok, true, JSON.stringify(saved))
  assert.equal(saved.call, 'helpers.countItems(args)')
  const res = await run(a, "return await helpers.countItems({ item: 'oak_log' })")
  assert.equal(res.observations.returned, 2)
  assert.deepEqual(res.observations.helpersUsed, ['count-items'])
  const list = await a.tool('list_helpers').run({ role: 'hunter' })
  assert.equal(list.helpers[0].id, 'count-items')
  const broken = await a.tool('save_helper').run({ title: 'Broken', description: 'does not compile', code: 'return (' })
  assert.equal(broken.ok, false)
  assert.match(broken.error.message, /does not compile/)
})

test('guarded bot refuses chat commands and attacks on players or named mobs', async () => {
  const bot = new FakeBot()
  bot.attack = () => { bot.calls.push(['attack']) }
  bot.entities = { 1: { id: 1, type: 'player', username: 'Player1', name: 'player' }, 2: { id: 2, type: 'mob', name: 'zombie' } }
  const a = augi(bot)
  assert.equal((await run(a, "bot.chat('/give Augi diamond')")).ok, false)
  assert.equal((await run(a, 'bot.attack(bot.entities[1])')).ok, false)
  assert.equal((await run(a, 'bot.attack(bot.entities[2])')).ok, true)
  assert.deepEqual(bot.calls.filter(c => c[0] === 'attack'), [['attack']])
  assert.equal(chatRefusal('hello'), null)
  assert.match(attackRefusal(bot, { name: 'wolf' }), /protected/)
  assert.match(attackRefusal(bot, { name: 'cow', customName: 'Bessie' }), /named/)
})

test('programs cannot replace guarded bot methods, so attack never recurses', async () => {
  const bot = new FakeBot()
  bot.attack = () => { bot.calls.push(['attack']) }
  bot.entities = { 2: { id: 2, type: 'mob', name: 'zombie' } }
  const a = augi(bot)
  const res = await run(a, "const orig = bot.attack\nbot.attack = e => orig(e)")
  assert.equal(res.ok, false)
  assert.match(res.error.message, /cannot be replaced/)
  assert.equal((await run(a, 'bot.attack(bot.entities[2])')).ok, true)
  assert.deepEqual(bot.calls.filter(c => c[0] === 'attack'), [['attack']])
})

test('chat, deaths and finished background jobs arrive in the next result inbox', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  bot.emit('chat', 'Player1', 'come here')
  const res = await run(a, 'return 1')
  assert.equal(res.inbox[0].type, 'chat')
  assert.equal(res.inbox[0].message, 'come here')
  const job = await a.tool('run_program').run({ code: 'await sleep(150)\nreturn "done"', background: true })
  assert.equal(job.jobId, 'job-2')
  const busy = await run(a, 'return 2')
  assert.equal(busy.error.category, 'busy')
  await new Promise(r => setTimeout(r, 250))
  const status = await a.tool('job_status').run({ jobId: 'job-2' })
  assert.equal(status.status, 'done')
  assert.equal(status.result.observations.returned, 'done')
  assert.equal(status.inbox.find(e => e.type === 'job_finished').jobId, 'job-2')
})

test('a bot death ends the running program and is reported with the death spot', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  await a.tool('run_program').run({ code: 'while (true) await sleep(20)', background: true, resume: false })
  bot.emit('death')
  await new Promise(r => setTimeout(r, 30))
  const status = await a.tool('job_status').run({ jobId: 'job-1' })
  assert.equal(status.status, 'failed')
  assert.equal(status.result.error.category, 'interrupted')
  assert.match(status.result.summary, /bot died/)
  const death = status.inbox.find(e => e.type === 'death')
  assert.deepEqual(death.position, { x: 0, y: 64, z: 0 })
})

test('defense="program" suspends the reflex only while the program runs', async () => {
  const a = augi()
  await a.tool('run_program').run({ code: 'await sleep(200)', background: true, defense: 'program' })
  assert.equal(a.session.travelDefenseActive, true)
  await a.tool('stop_action').run({})
  await new Promise(r => setTimeout(r, 20))
  assert.equal(a.session.travelDefenseActive, false)
  await a.tool('run_program').run({ code: 'await sleep(200)', background: true })
  assert.ok(!a.session.travelDefenseActive)
  await a.tool('stop_action').run({})
})

test('helper names and serialization', () => {
  assert.equal(helperName('chase-and-strike'), 'chaseAndStrike')
  const cyc = { a: 1 }; cyc.self = cyc
  assert.deepEqual(serialize(cyc), { a: 1, self: '[circular]' })
  assert.equal(serialize(undefined), null)
})

test('wait_for_chat wakes on a mention and returns pending events', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  setTimeout(() => bot.emit('chat', 'Player1', 'miner get me diamonds'), 20)
  const res = await a.tool('wait_for_chat').run({ seconds: 5, names: ['miner'] })
  assert.equal(res.woke, true)
  assert.equal(res.events[0].message, 'miner get me diamonds')
  bot.emit('chat', 'Player1', 'hey hunter get me food')
  const idle = await a.tool('wait_for_chat').run({ seconds: 1, names: ['builder'] })
  assert.equal(idle.woke, false)
  assert.equal(idle.events[0].message, 'hey hunter get me food')
})

test('a background job interrupted by self-defense reruns after the fight', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  await a.tool('run_program').run({ code: 'globalThis.runs = (globalThis.runs ?? 0) + 1\nif (globalThis.runs === 1) await sleep(5000)\nreturn globalThis.runs', background: true })
  await new Promise(r => setTimeout(r, 30))
  a.session.stop('self-defense priority')
  await new Promise(r => setTimeout(r, 400))
  const status = await a.tool('job_status').run({ jobId: 'job-1' })
  assert.equal(status.status, 'done', JSON.stringify(status))
  assert.equal(status.result.observations.returned, 2)
  assert.equal(status.result.resumes, 1)
  assert.ok(status.logs.some(l => l.includes('resuming 1/3')))
})

test('a job is not resumed when resume is false', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  await a.tool('run_program').run({ code: 'await sleep(5000)', background: true, resume: false })
  await new Promise(r => setTimeout(r, 30))
  a.session.stop('self-defense priority')
  await new Promise(r => setTimeout(r, 300))
  assert.equal((await a.tool('job_status').run({ jobId: 'job-1' })).status, 'failed')
  await a.tool('run_program').run({ code: 'await sleep(5000)', background: true, resume: false })
  await new Promise(r => setTimeout(r, 30))
  bot.emit('death')
  await new Promise(r => setTimeout(r, 300))
  const s = await a.tool('job_status').run({ jobId: 'job-2' })
  assert.equal(s.status, 'failed')
  assert.equal(s.result.resumes, 0)
})

test('a background job resumes after the bot dies and respawns', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  a.session.respawnSettleMs = 10
  await a.tool('run_program').run({ code: 'globalThis.lives = (globalThis.lives ?? 0) + 1\nif (globalThis.lives === 1) await sleep(5000)\nreturn globalThis.lives', background: true })
  await new Promise(r => setTimeout(r, 30))
  bot.health = 0
  bot.emit('death')
  await new Promise(r => setTimeout(r, 100))
  assert.equal(a.session.resumePending, 1, 'the night reflex sees a job waiting to resume')
  bot.health = 20 // respawned
  await new Promise(r => setTimeout(r, 400))
  const s = await a.tool('job_status').run({ jobId: 'job-1' })
  assert.equal(s.status, 'done', JSON.stringify(s))
  assert.equal(s.result.observations.returned, 2)
  assert.equal(s.result.deaths, 1)
  assert.equal(a.session.resumePending, 0)
  assert.ok(s.logs.some(l => l.includes('resuming (death 1)')))
})

test('background jobs keep resuming after every death, including deaths in a lost fight', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  a.session.respawnSettleMs = 0
  const resumes = async () => (await a.tool('job_status').run({ jobId: 'job-1' })).logs.filter(l => /resuming \(death \d+\)/.test(l)).length
  const waitFor = async check => { for (let i = 0; i < 300 && !(await check()); i++) await new Promise(r => setTimeout(r, 10)) }
  await a.tool('run_program').run({ code: 'while (true) await sleep(10)', background: true })
  // More deaths than the 3 fight resumes; odd ones die outright, even ones die in a fight.
  for (let death = 1; death <= 7; death++) {
    await waitFor(() => a.session.current?.tool === 'run_program')
    if (death % 2) bot.emit('death')
    else { a.session.defenseState.lastResult = { ok: false, summary: 'Defense stopped: bot died' }; a.session.stop('self-defense priority') }
    await waitFor(async () => await resumes() === death)
  }
  await waitFor(() => a.session.current?.tool === 'run_program')
  const status = await a.tool('job_status').run({ jobId: 'job-1' })
  assert.equal(status.status, 'running')
  assert.equal(await resumes(), 7)
  await a.tool('stop_action').run({})
})

test('players seen moving are remembered, shared with teammates, and searched for instead of asked about', async () => {
  const bot = new FakeBot()
  bot.username = 'Guard'
  const a = augi(bot)
  const kid = { id: 9, type: 'player', username: 'Player1', position: bot.entity.position.offset(2, 0, 0) }
  bot.players = { Player1: { username: 'Player1', entity: kid } }
  bot.emit('entityMoved', kid)
  const near = await run(a, "return await lib.go_to_player({ username: 'player1' })")
  assert.equal(near.observations.returned.ok, true, JSON.stringify(near))
  assert.equal(a.session.sightings.get('player1').by, 'Guard')
  delete bot.players.Player1.entity
  const found = await run(a, "return await lib.find_player({ username: 'Player1' })")
  assert.deepEqual(found.observations.returned.observations.lastSeen.position, { x: 2, y: 64, z: 0 })

  // Never seen by this bot and nowhere to be found: search, never ask for coordinates.
  a.session.lastSeen = {}
  a.session.sightings = null
  const lost = await run(a, "return await lib.go_to_player({ username: 'Player1', seconds: 5 })")
  const r = lost.observations.returned
  assert.equal(r.ok, false)
  assert.match(r.summary, /Searched 19 spot\(s\) around spawn/)
  assert.equal(r.observations.exhausted, true)
  assert.doesNotMatch(r.summary, /coordinates/)
  assert.equal(bot.chatSent.length, 0)
})

test('go_to_player walks to a teammate\'s sighting and stops when the player comes into view', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  bot.players = { Player1: { username: 'Player1' } }
  a.session.sightings.minIntervalMs = 0
  a.session.sightings.record({ username: 'Player1', position: { x: 300, y: 70, z: -40 }, dimension: 'overworld', by: 'Hunter' })
  bot.onArrive = pos => {
    if (Math.abs(pos.x - 301) < 1 && pos.z === -40) bot.players.Player1.entity = { id: 9, type: 'player', username: 'Player1', position: pos.offset(1, 0, 0) }
  }
  const res = await run(a, "return await lib.go_to_player({ username: 'Player1', seconds: 5 })")
  assert.equal(res.observations.returned.ok, true, JSON.stringify(res))
  assert.deepEqual(bot.calls.filter(c => c[0] === 'goto')[0], ['goto', 300, undefined, -40])
})

test('a player search resumes at the next waypoint on the next call', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  bot.players = { Player1: { username: 'Player1' } }
  a.session.lastSeen.player1 = { username: 'Player1', position: { x: 0, y: 64, z: 0 }, at: new Date().toISOString() }
  bot.pathfinder.goto = async () => { await new Promise(resolve => setTimeout(resolve, 1200)) }
  const first = await run(a, "return await lib.go_to_player({ username: 'Player1', seconds: 5 })")
  const left = first.observations.returned.observations.waypointsLeft
  assert.ok(left > 0 && left < 19, JSON.stringify(first))
  const second = await run(a, "return await lib.go_to_player({ username: 'Player1', seconds: 5 })")
  assert.ok(second.observations.returned.observations.waypointsLeft < left)
  assert.equal(first.observations.returned.observations.visited[0].x, 0)
  assert.notEqual(second.observations.returned.observations.visited[0].x, 0)
})

test('a stopped program cannot keep driving the bot or its pathfinder', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  await a.tool('run_program').run({ code: 'globalThis.oldPf = bot.pathfinder\nglobalThis.oldBot = bot\nawait sleep(5000)', background: true })
  await new Promise(r => setTimeout(r, 50))
  a.session.stop('test stop')
  await new Promise(r => setTimeout(r, 50))
  const res = await run(a, "const out = []\nfor (const f of [() => globalThis.oldPf.setGoal(null), () => globalThis.oldBot.lookAt(bot.entity.position), () => globalThis.oldBot.chat('hi')]) { try { f(); out.push('ran') } catch (e) { out.push(e.message) } }\nbot.pathfinder.setGoal(null)\nreturn out")
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.deepEqual(res.observations.returned, Array(3).fill('Program stopped: test stop'))
})

test('a hanging lib action times out on its own and stops at its next check', async () => {
  const { createLib } = await import('../runtime/program/lib.js')
  const { runProgram, createProgramContext } = await import('../runtime/program/runner.js')
  const { BotSession } = await import('../runtime/bot/session.js')
  let checks = 0
  const lib = createLib([{ name: 'stuck', input: {}, timeoutMs: 50, handler: async ctx => { for (;;) { await new Promise(r => setTimeout(r, 10)); checks++; ctx.checkAbort() } } }])
  const bot = new FakeBot()
  const session = new BotSession({ bot })
  const res = await session.run('run_program', ctx => runProgram(ctx, { code: 'const r = await lib.stuck()\nreturn r.error.category', context: createProgramContext(), lib }))
  assert.equal(res.observations.returned, 'timeout')
  const after = checks
  await new Promise(r => setTimeout(r, 50))
  assert.ok(checks - after <= 1, 'handler stopped after its timeout')
  assert.ok(bot.calls.some(c => c[0] === 'pathfinder.stop'))
})

test('set_task is remembered and shown by wait_for_chat and bot_status', async () => {
  const a = augi()
  await a.tool('set_task').run({ task: 'Kid1 wants 8 coal in the base chest; job-1' })
  const w = await a.tool('wait_for_chat').run({ seconds: 1 })
  assert.equal(w.task.text, 'Kid1 wants 8 coal in the base chest; job-1')
  assert.equal((await a.tool('bot_status').run({})).task.text, w.task.text)
  await a.tool('set_task').run({ task: '' })
  assert.equal((await a.tool('wait_for_chat').run({ seconds: 1 })).task, null)
})

test('a background job tells the agent to wait instead of polling', async () => {
  const a = augi()
  const r = await a.tool('run_program').run({ code: 'await sleep(300)', background: true })
  assert.match(r.summary, /wait_for_chat wakes you/)
  const w = await a.tool('wait_for_chat').run({ seconds: 5 })
  assert.equal(w.woke, true)
  assert.equal(w.events.find(e => e.type === 'job_finished').jobId, r.jobId)
})

test('a wait the client gave up on leaves its events for the next call', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  const stale = a.tool('wait_for_chat').run({ seconds: 5, names: ['Agent1'] })
  await new Promise(r => setTimeout(r, 100))
  // The client timed out and moved on: a newer call arrives while the old wait runs.
  bot.emit('chat', 'TestKid', 'Agent1, now go mine for diamonds')
  const fresh = a.tool('wait_for_chat').run({ seconds: 2, names: ['Agent1'] })
  const old = await stale
  assert.equal(old.superseded, true)
  assert.equal(old.events, undefined)
  const next = await fresh
  assert.equal(next.woke, true)
  assert.equal(next.events.find(e => e.type === 'chat').message, 'Agent1, now go mine for diamonds')
})

test('a program repeating the same chat line within two minutes sends it once', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  await run(a, "bot.chat('On it: 3 coal coming.')")
  await run(a, "bot.chat('On it: 3 coal coming.')\nbot.chat('Got 3 coal!')")
  assert.deepEqual(bot.chatSent, ['On it: 3 coal coming.', 'Got 3 coal!'])
})

test('lib actions take fractional coordinates and use the block they fall in', async () => {
  const bot = new FakeBot()
  const a = augi(bot)
  const res = await run(a, "const r = await lib.step_to({ x: 1.5, y: 64, z: 0.7 })\nreturn r.error?.category ?? 'ok'")
  assert.notEqual(res.observations.returned, 'invalid_argument', JSON.stringify(res))
})

test('lib.dig_tunnel is available to programs and checks its arguments', async () => {
  const a = augi()
  const res = await run(a, "return (await lib.dig_tunnel({ direction: 'up', length: 3 })).error.category")
  assert.equal(res.observations.returned, 'invalid_argument')
  const list = await a.tool('list_lib').run({})
  assert.ok(list.lib.some(e => e.name === 'dig_tunnel' && e.args.includes('slope')))
})
