---
id: stock-food-chest
title: Stock the food chest
description: "Hunter standing job: count food in the base food_chest; tend the wheat farm (lib.farm_wheat, bread), hunt and cook before late afternoon, fish if carrying a rod, then deposit all but `keep` food. Resumable; run every morning."
kind: program
level: 2
when:
  - food chest is low
  - hunter is idle in daylight
  - players or miners need food
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.stockFoodChest({ target = 16, keep = 4, seconds = 600, huntSeconds = 120, plots = 12, chest, farm })"
status: candidate
source:
  origin: learned
  created: 2026-10-17T20:19:38.489Z
  updated: 2026-10-17T20:19:38.489Z
version: 1
evidence: []
stats:
  successes: 0
  failures: 0
failure_modes:
  - farm site with no open soil (snow layers were the cause; farm_wheat now clears them)
  - dying while hunting far out at dusk
  - another player emptying the chest
tags:
  - hunter
  - food
---

Hunter standing job: count food in the base food_chest; tend the wheat farm (lib.farm_wheat, bread), hunt and cook before late afternoon, fish if carrying a rod, then deposit all but `keep` food. Resumable; run every morning.

Args: `{ target = 16, keep = 4, seconds = 600, huntSeconds = 120, plots = 12, chest, farm }`

## Code

```js
// Keep the base food chest stocked without help. Each pass: walk to the chest, count
// its food; if short, tend the wheat farm (bread), hunt and cook, fish when a rod and
// water are at hand, then deposit everything but `keep` food. Resumable and safe to
// repeat; plant early, wheat ripens on later passes.
const { target = 16, keep = 4, seconds = 600, huntSeconds = 120, plots = 12 } = args
const end = Date.now() + seconds * 1000
const FOODS = ['bread', 'cooked_beef', 'cooked_porkchop', 'cooked_mutton', 'cooked_chicken', 'cooked_rabbit', 'cooked_cod', 'cooked_salmon', 'baked_potato', 'carrot', 'apple']
const RAW = { beef: 'cooked_beef', porkchop: 'cooked_porkchop', mutton: 'cooked_mutton', chicken: 'cooked_chicken', rabbit: 'cooked_rabbit', cod: 'cooked_cod', salmon: 'cooked_salmon' }
const n = name => bot.inventory.items().filter(i => i.name === name).reduce((s, i) => s + i.count, 0)
const carried = () => FOODS.reduce((s, f) => s + n(f), 0)
const where = async (name, fallback) => { const r = await lib.recall_location({ name }); return r.ok ? r.observations.location.position : fallback }
const report = { chestBefore: null, farm: null, bread: 0, kills: 0, cooked: {}, fish: 0, deposited: {}, chestAfter: null }

const chest = args.chest ?? await where('food_chest', await where('base_chest', null))
if (!chest) return { ok: false, note: 'no food_chest or base_chest saved in this world: save one with lib.save_location, or pass chest' }
async function chestFood () {
  const go = await lib.navigate_to({ x: chest.x, y: chest.y, z: chest.z, range: 3 })
  if (!go.ok) log('to chest: ' + go.summary)
  const r = await lib.inspect_container({ x: chest.x, y: chest.y, z: chest.z })
  if (!r.ok) { log('chest: ' + r.summary); return null }
  return FOODS.reduce((s, f) => s + (r.observations.contents[f] ?? 0), 0)
}
async function eat () {
  if (bot.food >= 16) return
  const f = FOODS.find(x => n(x))
  if (f) await lib.eat_food({ item: f })
}
async function cookAll () {
  for (const [raw, cooked] of Object.entries(RAW)) {
    if (!n(raw)) continue
    const before = n(cooked)
    const r = await lib.obtain_item({ item: cooked, count: before + n(raw) })
    report.cooked[cooked] = (report.cooked[cooked] ?? 0) + n(cooked) - before
    log(`cook ${raw}: ${r.summary}`)
  }
}

await eat()
report.chestBefore = await chestFood()
const short = () => report.chestBefore === null || report.chestBefore + carried() - keep < target

// 1. Farm: a field next to water near the chest, saved as "farm" the first time.
if (Date.now() < end) {
  let farm = args.farm ?? await where('farm', null)
  if (!farm) {
    // Open grass or dirt (snow layers are fine) near the chest, water-side first.
    const ids = ['grass_block', 'dirt'].map(x => bot.registry.blocksByName[x].id)
    const water = bot.findBlocks({ matching: bot.registry.blocksByName.water.id, maxDistance: 32, count: 64 })
    const soil = bot.findBlocks({ matching: ids, maxDistance: 24, count: 400 }).map(p => bot.blockAt(p))
      .filter(b => b && ['air', 'short_grass', 'snow'].includes(bot.blockAt(b.position.offset(0, 1, 0))?.name))
    const wet = b => water.some(w => Math.abs(w.x - b.position.x) <= 4 && Math.abs(w.z - b.position.z) <= 4 && w.y >= b.position.y && w.y <= b.position.y + 1)
    const site = soil.find(wet) ?? soil[0]
    farm = site ? site.position : bot.entity.position.floored().offset(0, -1, 0)
    await lib.save_location({ name: 'farm', x: farm.x, y: farm.y, z: farm.z, note: 'wheat field (lib.farm_wheat center)' })
    log(`new farm at ${farm.x} ${farm.y} ${farm.z}${site && wet(site) ? ' by water' : ''}`)
  }
  const r = await lib.farm_wheat({ x: farm.x, y: farm.y, z: farm.z, radius: 4, plots, seconds: 150 })
  report.farm = r.summary
  log('farm: ' + r.summary)
  if (n('wheat') >= 3) {
    const before = n('bread')
    const b = await lib.obtain_item({ item: 'bread', count: before + Math.floor(n('wheat') / 3) })
    report.bread = n('bread') - before
    log('bread: ' + b.summary)
  }
}

// 2. Hunt in daylight and cook the meat.
// huntNearby spirals far out; only start with time to get back before dusk.
const lateDay = () => { const t = bot.time.timeOfDay; return t > 9000 && t < 23500 }
if (short() && !lateDay() && Date.now() < end) {
  const h = await helpers.huntNearby({ maxKills: 4, radius: 48, seconds: Math.min(huntSeconds, Math.max(10, (end - Date.now()) / 1000 - 120)) })
  report.kills = h.kills
  log(`hunt: ${h.kills} kills (${h.reason})`)
}
await cookAll()

// 3. Fish when carrying a rod and standing near open water.
if (short() && n('fishing_rod') && Date.now() < end) {
  const [w] = bot.findBlocks({ matching: bot.registry.blocksByName.water.id, maxDistance: 16, count: 32 })
    .map(p => bot.blockAt(p)).filter(b => bot.blockAt(b.position.offset(0, 1, 0))?.name === 'air')
  if (w) {
    for (let i = 0; i < 6 && Date.now() < end - 60000; i++) {
      const go = await lib.navigate_to({ x: w.position.x, y: w.position.y, z: w.position.z, range: 4, walkOnly: true })
      if (!go.ok) break
      const f = await lib.fish_once({ x: w.position.x, y: w.position.y, z: w.position.z })
      if (f.ok) report.fish += f.observations.cookableFish ?? 0
      else if (f.error?.category !== 'timeout') { log('fish: ' + f.summary); break }
    }
    await cookAll()
  }
}

// 4. Deposit all food except `keep` items for ourselves.
await eat()
await lib.navigate_to({ x: chest.x, y: chest.y, z: chest.z, range: 3 })
let spare = carried() - keep
for (const f of FOODS) {
  if (spare <= 0) break
  const k = Math.min(n(f), spare)
  if (!k) continue
  const d = await lib.deposit_items({ item: f, count: k, x: chest.x, y: chest.y, z: chest.z })
  if (d.ok) { report.deposited[f] = k; spare -= k } else log('deposit: ' + d.summary)
}
report.chestAfter = await chestFood()
log(`food chest: ${report.chestBefore} -> ${report.chestAfter}`)
return report
```

## Notes

Hunting near dusk got the hunter killed, so it only hunts before time 9000. Wheat ripens over about 30 minutes.
