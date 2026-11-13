import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { BotSession } from '../runtime/bot/session.js'
import { selfDefense, visibleThreats, resumeWork, startTravelDefense } from '../runtime/tools/self-defense.js'

function fixture (name = 'zombie', inventory = { stone_sword: 1 }) {
  const bot = new FakeBot({ inventory, position: [450.5, 66, 290.5] })
  bot.entity.id = 1
  const mob = { id: 2, name, height: 1.8, position: new Vec3(450.5, 66, 288.5) }
  bot.entities = { 1: bot.entity, 2: mob }
  bot.world.raycast = () => null
  bot.unequip = async () => { bot.heldItem = null }
  bot.attack = e => { bot.calls.push(['attack', e.id]); bot.emit('entityDead', e); delete bot.entities[e.id] }
  const policy = { dimension: 'overworld', approach: { x: 120, y: 64, z: -305 }, inside: { x: 120, y: 64, z: -299 }, doors: [{ x: 120, y: 64, z: -300 }] }
  return { bot, mob, policy }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
const localOnly = (bot, policy) => {
  assert.equal(bot.calls.some(c => c[0] === 'goto' || c[0] === 'activateBlock'), false)
  assert.equal(bot.calls.some(c => c[0] === 'setGoal' && c[1]?.x === policy.inside.x), false)
  assert.equal(bot.chatSent.some(s => /retreat|shelter|closing|defending/.test(s)), false)
}

test('local defense kills and collects nearby without base travel', async () => {
  const { bot, policy } = fixture()
  const result = await selfDefense(ctxFor(bot, { session: { defensePolicy: policy } }))
  assert.equal(result.ok, true)
  assert.equal(result.observations.kills, 1)
  assert.equal(result.observations.retreated, false)
  assert.equal(result.observations.mode, 'local-defense')
  assert.equal(bot.listenerCount('entityDead'), 0)
  localOnly(bot,policy)
})
test('injured, hungry, unarmed and creeper cases defend locally instead of returning to base', async () => {
  for (const mode of ['unarmed','low','hungry','unknown']) {
    const { bot,policy }=fixture(mode==='creeper'?'creeper':'spider',mode==='unarmed'?{}:{stone_sword:1})
    if(mode==='low')bot.health=3
    if(mode==='hungry')bot.food=2
    const result=await selfDefense(ctxFor(bot,{session:{defensePolicy:policy}}),{reason:mode==='unknown'?'unattributed damage':'hostile nearby'})
    assert.equal(result.ok,true,mode)
    assert.equal(result.observations.attacks,1,mode)
    assert.equal(result.observations.retreated,false,mode)
    localOnly(bot,policy)
  }
})
test('players, pets, named mobs and mobs behind walls are never selected',async()=>{
  for(const mode of ['player','pet','wall']){
    const {bot,mob,policy}=fixture()
    if(mode==='player')mob.username='Player1'
    if(mode==='pet')mob.customName='Friend'
    if(mode==='wall')bot.world.raycast=()=>({name:'stone'})
    assert.deepEqual(visibleThreats(bot),[])
    const result=await selfDefense(ctxFor(bot,{session:{defensePolicy:policy}}),{attackerId:mode==='wall'?undefined:mob.id})
    assert.equal(result.observations.attacks,0)
    localOnly(bot,policy)
  }
})
test('unknown damage without visible mob does not invent an attacker or travel',async()=>{
  const {bot,policy}=fixture();delete bot.entities[2]
  const result=await selfDefense(ctxFor(bot,{session:{defensePolicy:policy}}),{reason:'unattributed damage'})
  assert.equal(result.ok,true);assert.equal(result.observations.attacks,0);localOnly(bot,policy)
})
test('local boundary and timeout stop pursuit without automatic base travel',async()=>{
  for(const mode of ['far','stalled']){
    const {bot,mob,policy}=fixture()
    if(mode==='far')mob.position.x+=9
    else bot.attack=e=>bot.calls.push(['attack',e.id])
    const original=bot.pathfinder.movements
    const result=await selfDefense(ctxFor(bot,{session:{defensePolicy:policy}}))
    assert.equal(result.observations.retreated,false)
    if(mode==='stalled'){assert.equal(result.error.category,'partial');assert.equal(result.observations.attacks,30)}
    assert.equal(bot.pathfinder.movements,original);localOnly(bot,policy)
  }
})
test('a close creeper is never hit; defense keeps out of its fuse radius locally',async()=>{
  const {bot,policy}=fixture('creeper');bot.attack=e=>bot.calls.push(['attack',e.id])
  await selfDefense(ctxFor(bot,{session:{defensePolicy:policy}}))
  const steps=bot.calls.filter(c=>c[0]==='setGoal'&&c[1]?.constructor.name==='GoalNearXZ')
  assert.ok(steps.length>0);assert.equal(bot.calls.filter(c=>c[0]==='attack').length,0);localOnly(bot,policy)
  const away=steps[0][1];assert.ok(Math.hypot(away.x-450.5,away.z-288.5)>4,'flees away from the creeper')
})
test('zombie fight switches to keeping away when a creeper comes close',async()=>{
  const {bot,policy}=fixture('zombie');bot.attack=e=>bot.calls.push(['attack',e.id])
  bot.entities[3]={id:3,name:'creeper',height:1.7,position:new Vec3(452.5,66,290.5)}
  await selfDefense(ctxFor(bot,{session:{defensePolicy:policy}}))
  assert.equal(bot.calls.filter(c=>c[0]==='attack').length,0)
  assert.ok(bot.calls.some(c=>c[0]==='setGoal'&&c[1]?.constructor.name==='GoalNearXZ'))
})
test('cancellation restores movement, controls and listeners',async()=>{
  const {bot,policy}=fixture();const original=bot.pathfinder.movements
  const ctx=ctxFor(bot,{session:{defensePolicy:policy}})
  bot.attack=()=>{};bot.waitForTicks=async()=>{ctx.signal.aborted=true}
  await assert.rejects(selfDefense(ctx),/interrupted/)
  assert.equal(bot.pathfinder.movements,original);assert.equal(bot.listenerCount('entityDead'),0)
  localOnly(bot,policy)
})
test('automatic defense waits for interrupted action cleanup before fighting',async()=>{
  const {bot,mob,policy}=fixture();const session=new BotSession({bot,defensePolicy:policy})
  let release;const gate=new Promise(r=>{release=r});let cleaned=false
  const action=session.run('mining',async ctx=>{try{await gate;ctx.checkAbort()}finally{cleaned=true}})
  await settle();bot.emit('entityHurt',bot.entity,mob)
  assert.equal(session.current.signal.aborted,true);assert.equal(bot.calls.some(c=>c[0]==='attack'),false)
  release();await action;await settle()
  assert.equal(cleaned,true);assert.equal(session.defenseState.lastResult.observations.kills,1)
  assert.equal(session.defenseState.paused,false);localOnly(bot,policy)
  bot.emit('end');assert.equal(bot.listenerCount('entityHurt'),0)
})
test('idle scan and unattributed health drop trigger local defense',async()=>{
  for(const mode of ['scan','health']){
    const {bot,policy}=fixture('spider');const session=new BotSession({bot,defensePolicy:policy})
    if(mode==='scan')for(let i=0;i<10;i++)bot.emit('physicsTick')
    else{bot.health=5;bot.emit('health')}
    await settle();assert.equal(session.defenseState.lastResult.observations.kills,1)
    assert.equal(session.defenseState.lastResult.observations.retreated,false);localOnly(bot,policy);bot.emit('end')
  }
})
test('timed-out handler retains lock until actual cleanup settles',async()=>{
  const {bot,policy}=fixture('spider');const session=new BotSession({bot,defensePolicy:policy})
  let release;const old=session.run('slow',()=>new Promise(r=>{release=r}),{timeoutMs:5})
  assert.equal((await old).error.category,'timeout')
  for(let i=0;i<10;i++)bot.emit('physicsTick')
  await settle();assert.equal(session.defenseState.lastResult,null)
  release({ok:false,summary:'cleaned'});await settle()
  assert.equal(session.defenseState.lastResult.observations.retreated,false);bot.emit('end')
})
test('resume_work acknowledges a bounded pause without forcing base travel',async()=>{
  const {bot,policy}=fixture();const session=new BotSession({bot,defensePolicy:policy});session.defenseState.paused=true
  assert.equal((await session.run('resume_work',resumeWork)).ok,true)
  delete bot.entities[2];bot.health=5
  assert.equal((await session.run('resume_work',resumeWork)).ok,true)
  assert.equal(session.defenseState.paused,false);localOnly(bot,policy);bot.emit('end')
})
test('manual stop cancels queued defense before old action releases control',async()=>{
  const {bot,mob,policy}=fixture();const session=new BotSession({bot,defensePolicy:policy})
  let release;const active=session.run('old',()=>new Promise(r=>{release=r}));await settle()
  bot.emit('entityHurt',bot.entity,mob);session.stop('stop_action called')
  release({ok:false,summary:'cancelled'});await active;await settle()
  assert.equal(session.defenseState.lastResult,null);assert.equal(bot.calls.some(c=>c[0]==='attack'),false);bot.emit('end')
})

test('instant respawn after death is reported as death, never a boundary exit or success', async () => {
  const { bot } = fixture()
  bot.attack = () => { bot.emit('death'); bot.health = 20; bot.entity.position = new Vec3(0, 70, 0) }
  const result = await selfDefense(ctxFor(bot))
  assert.equal(result.ok, false)
  assert.equal(result.observations.died, true)
  assert.match(result.summary, /bot died/)
  assert.equal(result.observations.retreated, false)
  assert.equal(bot.listenerCount('death'), 0)
})

test('pursuit keeps one dynamic follow goal while repeatedly hitting and counting real damage', async () => {
  const { bot } = fixture()
  let hits = 0
  bot.attack = e => {
    bot.emit('entityHurt', e)
    if (++hits === 4) { bot.emit('entityDead', e); delete bot.entities[e.id] }
  }
  const result = await selfDefense(ctxFor(bot))
  assert.equal(result.observations.kills, 1)
  assert.equal(result.observations.attacks, 4)
  assert.equal(result.observations.damageEvents, 4)
  const follow = bot.calls.filter(c => c[0] === 'setGoal' && c[1]?.constructor.name === 'GoalFollow')
  assert.equal(follow.length, 1)
  assert.equal(follow[0][1].rangeSq, 1)
})

test('travel ignores distant visible mobs, but close mobs and ore work trigger defense', async () => {
  for (const mode of ['travel', 'mining', 'close']) {
    const { bot, mob, policy } = fixture()
    mob.position = bot.entity.position.offset(mode === 'close' ? 2 : 6, 0, 0)
    const session = new BotSession({ bot, defensePolicy: policy })
    let release
    const active = session.run(mode === 'mining' ? 'dig_block' : 'navigate_to', () => new Promise(r => { release = r }))
    await settle()
    for (let i = 0; i < 10; i++) bot.emit('physicsTick')
    assert.equal(session.current.signal.aborted, mode !== 'travel', mode)
    release({ ok: true }); await active; await settle()
    assert.equal(session.defenseState.lastResult === null, mode === 'travel', mode)
    bot.emit('end')
  }
})

test('travel defense keeps destination and controls while repeatedly attacking nearby mobs', async () => {
  const { bot, mob, policy } = fixture()
  const session = new BotSession({ bot, defensePolicy: policy })
  let hits = 0
  bot.attack = e => {
    bot.calls.push(['attack', e.id]); bot.emit('entityHurt', e)
    if (++hits === 3) { bot.emit('entityDead', e); delete bot.entities[e.id] }
  }
  const ctx = ctxFor(bot, { session })
  const defense = await startTravelDefense(ctx)
  for (let n = 0; n < 65; n++) bot.emit('physicsTick')
  assert.deepEqual(defense.report, { attacks: 3, damageEvents: 3, kills: 1, died: false })
  assert.equal(session.defenseState.lastResult, null)
  assert.equal(bot.calls.some(c => ['setGoal', 'setControlState', 'lookAt'].includes(c[0])), false)
  defense.stop(); assert.equal(session.travelDefenseActive, false)
  const count = hits; bot.emit('physicsTick'); assert.equal(hits, count)
  bot.emit('end'); assert.equal(bot.listenerCount('entityHurt'), 0)
})

test('travel defense ignores distant and protected targets, cleans up, and latches instant death', async () => {
  for (const mode of ['far', 'player', 'named', 'wall', 'cancel']) {
    const { bot, mob, policy } = fixture()
    const session = new BotSession({ bot, defensePolicy: policy })
    if (mode === 'far') mob.position.x += 7
    if (mode === 'player') mob.username = 'Player1'
    if (mode === 'named') mob.customName = 'Pet'
    if (mode === 'wall') bot.world.raycast = () => ({ name: 'stone' })
    const ctx = ctxFor(bot, { session }); const defense = await startTravelDefense(ctx)
    if (mode === 'cancel') ctx.signal.aborted = true
    for (let i = 0; i < 10; i++) bot.emit('physicsTick')
    assert.equal(defense.report.attacks, 0, mode)
    defense.stop(); bot.emit('end')
  }
  const { bot, policy } = fixture(); const session = new BotSession({ bot, defensePolicy: policy })
  let release
  const active = session.run('navigate_to', async ctx => {
    const defense = await startTravelDefense(ctx)
    try { await new Promise(r => { release = r }); return { ok: true, observations: defense.report } } finally { defense.stop() }
  })
  await settle(); bot.emit('death'); bot.health = 20
  assert.equal(session.current.signal.aborted, true)
  release(); const result = await active; assert.equal(result.observations?.died ?? result.died, true)
  assert.equal(session.travelDefenseActive, false); bot.emit('end')
})

test('nearby mobs and a prior failed defense never gate requested work or resume', async () => {
  const { bot, policy } = fixture(); const session = new BotSession({ bot, defensePolicy: policy })
  session.defenseState.paused = true
  let performed = false
  const result = await session.run('craft_item', async () => { performed = true; return { ok: true } })
  assert.equal(result.ok, true); assert.equal(performed, true)
  assert.equal((await session.run('resume_work', resumeWork)).ok, true)
  assert.equal(session.defenseState.paused, false); bot.emit('end')
})

test('requested work preempts defense and waits for actual cleanup before taking control', async () => {
  const { bot, policy } = fixture(); const session = new BotSession({ bot, defensePolicy: policy })
  let release; let cleaned = false; let performed = false
  const defense = session.run('self_defense', async ctx => {
    try { await new Promise(r => { release = r }); ctx.checkAbort() } finally { cleaned = true }
  })
  await settle()
  const work = session.run('navigate_to', async () => { assert.equal(cleaned, true); performed = true; return { ok: true } })
  await settle(); assert.equal(performed, false); assert.equal(session.current.signal.aborted, true)
  release(); await defense; assert.equal((await work).ok, true); assert.equal(performed, true)
  bot.emit('end')
})

test('requested work cancels a queued reflex instead of being rejected because mobs are present', async () => {
  const { bot, mob, policy } = fixture(); const session = new BotSession({ bot, defensePolicy: policy })
  let release
  const old = session.run('dig_block', () => new Promise(r => { release = r }))
  await settle(); bot.emit('entityHurt', bot.entity, mob)
  const work = session.run('navigate_to', async () => ({ ok: true }))
  await settle(); release({ ok: false }); await old
  assert.equal((await work).ok, true)
  await settle(); assert.equal(session.defenseState.lastResult, null); bot.emit('end')
})
test('damage with no mob in sight does not interrupt running work',async()=>{
  const {bot,policy}=fixture();delete bot.entities[2]
  const session=new BotSession({bot,defensePolicy:policy})
  let release;const gate=new Promise(r=>{release=r})
  const action=session.run('mining',async ctx=>{await gate;ctx.checkAbort();return {ok:true,summary:'mined'}})
  await settle();bot.health=15;bot.emit('health');bot.emit('entityHurt',bot.entity,null)
  assert.equal(session.current.signal.aborted,false)
  release();assert.equal((await action).ok,true)
  bot.emit('end')
})
