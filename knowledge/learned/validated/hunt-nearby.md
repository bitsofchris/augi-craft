---
id: hunt-nearby
title: Hunt nearby livestock
description: "Continuous hunt loop: chase the nearest livestock, strike on the sword cooldown, confirm kills, collect drops, fight close hostiles, avoid creepers, eat (raw meat if needed), quit on low health."
kind: program
level: 2
when:
  - need food or leather
  - player asks to hunt
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.huntNearby({ maxKills = 3, radius = 64, seconds = 120, minHealth = 8 })"
status: validated
source:
  origin: learned
  created: 2026-10-17T15:45:03.091Z
  updated: 2026-10-17T18:19:29.676Z
version: 5
evidence:
  - episode: 2026-10-17-15-54-42
    outcome: failure
    note: "v1 at night, started hurt: quit on low health, no kills"
    date: 2026-10-17T15:54:51.393Z
  - episode: 2026-10-17-15-54-42
    outcome: success
    note: "v2 daylight: pig + 2 sheep in 107 s, porkchop +2 mutton +3"
    date: 2026-10-17T15:54:51.406Z
  - episode: 2026-10-17-17-55-59
    outcome: success
    note: "4 kills: cow, sheep, cow, cow"
    date: 2026-10-17T17:55:59.636Z
stats:
  successes: 2
  failures: 1
failure_modes:
  - 'Night hostiles: run with defense "program" so the loop fights them instead of the reflex stopping the hunt.'
  - Kills on a slope or in water can leave drops uncollected; collectDrops only searches 8 blocks for 5 seconds.
  - "Starting hurt at night: the loop quits at minHealth; eat and wait for day first."
tags:
  - hunter
  - food
---

Continuous hunt loop: chase the nearest livestock, strike on the sword cooldown, confirm kills, collect drops, fight close hostiles, avoid creepers, eat (raw meat if needed), quit on low health.

Args: `{ maxKills = 3, radius = 64, seconds = 120, minHealth = 8 }`

## Code

```js
// Continuous hunt loop: chase the nearest livestock, strike on the sword cooldown,
// confirm kills by entityDead, pick up drops. Fights hostiles that come close,
// backs away from creepers, eats when hungry, and quits early on low health.
const { maxKills = 3, radius = 64, seconds = 120, minHealth = 8 } = args
const LIVESTOCK = new Set(['cow', 'pig', 'sheep', 'chicken', 'rabbit'])
const HOSTILE = new Set(['zombie', 'husk', 'drowned', 'skeleton', 'stray', 'spider', 'cave_spider', 'slime', 'witch', 'pillager', 'zombie_villager', 'bogged'])
const FOOD = ['cooked_beef', 'cooked_porkchop', 'cooked_mutton', 'cooked_chicken', 'cooked_rabbit', 'bread', 'baked_potato', 'carrot', 'apple', 'beef', 'porkchop', 'mutton', 'rabbit', 'potato'] // raw meat last; raw chicken can poison
const end = Date.now() + seconds * 1000
const me = () => bot.entity.position
const dist = e => e.position.distanceTo(me())
const nearest = (pred, max) => {
  let best = null; let bd = max
  for (const e of Object.values(bot.entities)) {
    if (e === bot.entity || !pred(e)) continue
    const d = dist(e)
    if (d < bd) { best = e; bd = d }
  }
  return best
}
const sword = bot.inventory.items().filter(i => i.name.endsWith('_sword')).sort((a, b) => b.maxDurability - a.maxDurability)[0]
if (sword) await bot.equip(sword, 'hand')

let target = null
let lastHit = 0
const kills = []
const fought = []
lib.on('entityDead', e => {
  if (!target || e.id !== target.id) return
  if (LIVESTOCK.has(e.name)) { kills.push(e.name); log(`killed ${e.name} (${kills.length}/${maxKills})`) } else { fought.push(e.name); log(`killed hostile ${e.name}`) }
  target = null
})

async function strike (e) {
  bot.pathfinder.setGoal(new goals.GoalFollow(e, 1.5), true)
  if (dist(e) < 3.2 && Date.now() - lastHit > 650) {
    await bot.lookAt(e.position.offset(0, e.height * 0.6, 0), true)
    bot.attack(e)
    lastHit = Date.now()
  }
}
async function collectDrops () {
  const until = Date.now() + 5000
  while (Date.now() < until) {
    const item = nearest(e => e.name === 'item', 8)
    if (!item) return
    bot.pathfinder.setGoal(new goals.GoalNear(item.position.x, item.position.y, item.position.z, 0))
    await sleep(200)
  }
}
async function eatIfHungry () {
  if (bot.food >= 18 || (bot.food > 14 && bot.health > 12)) return // health only regenerates at food 18+
  const food = bot.inventory.items().find(i => FOOD.includes(i.name))
  if (!food) return
  bot.pathfinder.setGoal(null)
  const ate = await lib.eat_food({ item: food.name }) // bot.consume times out on 26.3
  if (!ate.ok) log(`eat failed: ${ate.summary}`)
  if (sword) await bot.equip(sword, 'hand')
}

let reason = 'time budget used'
let wanders = 0
while (Date.now() < end) {
  if (kills.length >= maxKills) { reason = 'kill target reached'; break }
  if (bot.health < minHealth) { reason = `health low (${Math.round(bot.health)})`; log(reason); break }
  await eatIfHungry()

  const creeper = nearest(e => e.name === 'creeper', 7)
  if (creeper) {
    if (!globalThis.__creeperLogged) log('backing away from a creeper')
    globalThis.__creeperLogged = true
    bot.pathfinder.setGoal(new goals.GoalInvert(new goals.GoalFollow(creeper, 10)), true)
    await sleep(300)
    continue
  }
  const threat = nearest(e => HOSTILE.has(e.name), 6)
  if (threat) {
    if (target?.id !== threat.id) log(`fighting ${threat.name} at ${Math.round(dist(threat))} blocks, health ${Math.round(bot.health)}`)
    target = threat; await strike(threat); await sleep(100); continue
  }

  if (target && (!bot.entities[target.id] || !HOSTILE.has(target.name) && !LIVESTOCK.has(target.name))) target = null
  if (target && HOSTILE.has(target.name)) target = null
  target ??= nearest(e => LIVESTOCK.has(e.name) && !e.customName, radius)
  if (!target) {
    // Spiral outward from the start so a hunted-out area is left behind.
    globalThis.huntOrigin ??= me().clone()
    const a = wanders * 2.4; const r = 24 + 12 * wanders++
    if (wanders === 1) log('no livestock in sight; searching further out')
    bot.pathfinder.setGoal(new goals.GoalNearXZ(globalThis.huntOrigin.x + r * Math.cos(a), globalThis.huntOrigin.z + r * Math.sin(a), 3))
    for (let i = 0; i < 60 && !nearest(e => LIVESTOCK.has(e.name), radius); i++) await sleep(250)
    continue
  }
  await strike(target)
  await sleep(100)
  if (!target) await collectDrops()
}
bot.pathfinder.setGoal(null)
await collectDrops()
bot.pathfinder.setGoal(null)
return { kills: kills.length, killed: kills, hostilesKilled: fought, reason, health: bot.health, food: bot.food }
```
