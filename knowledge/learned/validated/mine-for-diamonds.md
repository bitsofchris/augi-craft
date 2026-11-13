---
id: mine-for-diamonds
title: Mine for diamonds
description: "One proper diamond mine next to base: a saved 1x2 staircase down to y -54, a branch mine there (main corridor, side branches every 4 blocks, working face saved), iron pickaxe from the first iron, visible ores only, then up the stairs and diamonds plus ores into the base chest. Resumable; dying is fine."
kind: program
level: 2
when:
  - player asks for diamonds
  - need iron or diamonds
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.mineForDiamonds({ count = 8, ironY = 16, diamondY = -54, seconds = 840, food = 12, chest, base, branchLength = 16, branchSpacing = 3, mine = 'base_mine', siteRadius = [24, 30, 36, 42] })"
status: validated
source:
  origin: learned
  created: 2026-10-17T17:16:04.459Z
  updated: 2026-10-18T14:02:22.354Z
version: 31
evidence:
  - episode: 2026-10-17-19-18-22
    outcome: failure
    note: no diamonds; best run reached y 31 with an iron pickaxe
    date: 2026-10-17T19:18:22.495Z
  - episode: 2026-10-17-20-16-44
    outcome: failure
    note: Job-2 ran v11, not newly saved v12. Timed out at iron level after 93 steps; no iron or diamonds.
    date: 2026-10-17T20:16:56.701Z
  - episode: 2026-10-17-20-19-45
    outcome: failure
    note: v12 completed 80 tunnel steps and returned safely but found no iron or diamonds.
    date: 2026-10-17T20:19:47.606Z
  - episode: 2026-10-18-11-40-51
    outcome: failure
    note: Water underneath saved surface entrance prevents descent.
    date: 2026-10-18T11:40:56.333Z
  - episode: 2026-10-18-12-43-34
    outcome: success
    note: v23 delivered6 diamonds2 raw iron10 redstone; short-leg climb succeeded.
    date: 2026-10-18T12:43:44.111Z
  - episode: 2026-10-18-12-45-08
    outcome: success
    note: 6 diamonds deposited in the base chest, verified by inspection
    date: 2026-10-18T12:45:08.871Z
  - episode: 2026-10-18-13-08-08
    outcome: success
    note: Delivered3 diamonds4 raw iron8 raw gold35 redstone with no deaths or resumes.
    date: 2026-10-18T13:08:14.026Z
  - episode: 2026-10-18-14-51-03
    outcome: failure
    note: Two deaths, no food, repeated unproductive recovery at hunger 10; timed out without iron, diamonds or deposit.
    date: 2026-10-18T14:51:09.167Z
stats:
  successes: 3
  failures: 5
failure_modes:
  - suffocated in a wall after a rejected dig (guarded)
  - bot.dig hung on tuff (timed)
  - food chest emptied by another player
  - random tunnels found no ore; replaced by a branch mine
tags:
  - gatherer
  - diamond
  - mining
---

One proper diamond mine next to base: a saved 1x2 staircase down to y -54, a branch mine there (main corridor, side branches every 4 blocks, working face saved), iron pickaxe from the first iron, visible ores only, then up the stairs and diamonds plus ores into the base chest. Resumable; dying is fine.

Args: `{ count = 8, ironY = 16, diamondY = -54, seconds = 840, food = 12, chest, base, branchLength = 16, branchSpacing = 3, mine = 'base_mine', siteRadius = [24, 30, 36, 42] }`

## Code

```js
// Go get diamonds from one proper mine next to base, then store them in the base chest.
// The mine: an entrance saved as `base_mine`, a 1x2 staircase in a fixed direction
// down to diamondY (bottom saved as `base_mine_bottom`), and a branch mine there
// (main corridor, side branches every 4 blocks; the working face saved as
// `base_mine_face`). Every trip reuses the staircase and continues at the face.
// Resumable: each run picks up from the current depth, saved places and inventory.
// Only mines ore it can see (no x-ray). Never digs next to lava or under water.
// Dying is fine: the job reruns after respawn and walks back down the same stairs.
// mine: name prefix for this mine's saved places (a second mine uses another name).
// siteRadius: how far from base to look for a dry entrance.
const { count = 8, ironY = 16, diamondY = -54, seconds = 840, food = 12, branchLength = 16, branchSpacing = 3, mine = 'base_mine', siteRadius = [24, 30, 36, 42] } = args
// Base and chest come from this world's saved places (or args), never fixed coordinates.
const savedAt = async name => { const r = await lib.recall_location({ name }); return r.ok ? r.observations.location.position : null }
const chest = args.chest ?? await savedAt('base_chest')
const baseChest = chest
const base = args.base ?? await savedAt('base')
if (!chest || !base) return { ok: false, note: 'no base or base_chest saved in this world: save them with lib.save_location, or pass base and chest' }
const end = Date.now() + seconds * 1000
bot.pathfinder.thinkTimeout = 20000 // long mine paths need more than the 5 s default
// Underground, a 1x2 tunnel has no free spot for a crafting table or furnace: dig a side niche first.
// Mobs spawn in the dark: put a torch on the floor where block light is low.
async function light () {
  if (!n('torch')) return
  const p = bot.entity.position.floored()
  const here = bot.blockAt(p)
  if (!here || !here.name.endsWith('air') || (here.light ?? 0) >= 8) return
  const under = bot.blockAt(p.offset(0, -1, 0))
  if (!solid(under)) return
  await bot.equip(bot.inventory.items().find(i => i.name === 'torch'), 'hand')
  try { await bot.placeBlock(under, new Vec3(0, 1, 0)) } catch {}
}
async function makeRoom () {
  const p = bot.entity.position.floored()
  for (const d of DIRS) {
    const q = p.plus(d)
    if (solid(bot.blockAt(q)) && solid(bot.blockAt(q.offset(0, -1, 0))) && !nearLiquid(q)) { if (await digAt(q)) return true }
  }
  return false
}
async function craftIronPickaxe () {
  let r = await lib.obtain_item({ item: 'iron_pickaxe' })
  if (!r.ok && /free spot|place/i.test(r.summary)) { await makeRoom(); r = await lib.obtain_item({ item: 'iron_pickaxe' }) }
  log('iron pickaxe: ' + r.summary)
}
// Long climbs: go toward a target in 16-block legs (digging if needed) when one path is too long to plan.
async function goTowards (t, range = 2) {
  for (let i = 0; i < 30; i++) {
    const here = bot.entity.position
    if (here.distanceTo(t) <= range + 1) return true
    const r = await lib.navigate_to({ x: t.x, y: t.y, z: t.z, range })
    if (r.ok) return true
    const v = t.minus(here); const len = v.norm()
    const leg = here.plus(v.scaled(Math.min(1, 16 / len))).floored()
    const l = await lib.navigate_to({ x: leg.x, y: leg.y, z: leg.z, range: 2 })
    if (!l.ok) { const l2 = here.plus(v.scaled(Math.min(1, 8 / len))).floored(); await lib.navigate_to({ x: l2.x, y: l2.y, z: l2.z, range: 2 }) }
  }
  return bot.entity.position.distanceTo(t) <= range + 3
}
const place = async name => { const r = await lib.recall_location({ name }); return r.ok ? new Vec3(Math.floor(r.observations.location.position.x), Math.floor(r.observations.location.position.y), Math.floor(r.observations.location.position.z)) : null }
const remember = (name, p, note) => lib.save_location({ name, x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), note })
const ORES = ['diamond', 'iron', 'coal', 'gold', 'redstone', 'lapis_lazuli']
const n = name => bot.inventory.items().filter(i => i.name === name).reduce((s, i) => s + i.count, 0)
const pickTier = () => ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe'].some(p => n(p)) ? 'iron' : (n('stone_pickaxe') ? 'stone' : (n('wooden_pickaxe') ? 'wood' : 'none'))
const LIQUID = new Set(['lava', 'water'])
const solid = b => b && b.boundingBox === 'block' && !LIQUID.has(b.name)
// Lava anywhere next to a block is a hard stop; water only when it is the
// block itself or directly above (it would pour into the tunnel).
const nearLiquid = p => [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([x, y, z]) => {
  const name = bot.blockAt(p.offset(x, y, z))?.name
  return name === 'lava' || (name === 'water' && x === 0 && z === 0 && y >= 0)
})
const DIRS = [new Vec3(1, 0, 0), new Vec3(0, 0, 1), new Vec3(-1, 0, 0), new Vec3(0, 0, -1)]
let dir = DIRS[0]
let steps = 0
const found = {}

let why = ''
// Mining fills the inventory with stone; keep one stack of cobblestone and dirt.
// Keep only what the trip needs; everything else (clay, moss, amethyst, basalt, extra stone) goes.
const KEEP = /(_pickaxe|_sword|_axe|_shovel|_helmet|_chestplate|_leggings|_boots|^diamond$|^raw_|_ingot$|^coal$|^redstone$|^lapis_lazuli$|^emerald$|^torch$|^stick$|_planks$|_log$|^crafting_table$|^furnace$|^cooked_|^bread$|^baked_potato$|^beef$|^porkchop$|^mutton$|^rabbit$|^apple$|^carrot$|^bow$|^arrow$|^shield$|_bed$|^wheat_seeds$|^string$|^feather$|^bone$|^leather$|^gunpowder$|^fishing_rod$)/
async function dropJunk () {
  if (bot.inventory.emptySlotCount() > 5) return
  const kept = {}
  for (const it of bot.inventory.items()) {
    if (KEEP.test(it.name)) continue
    // One stack of cobblestone and one of dirt for pickaxes and floor gaps.
    if ((it.name === 'cobblestone' || it.name === 'dirt') && !kept[it.name]) { kept[it.name] = true; continue }
    await bot.tossStack(it)
  }
  log(`dropped junk stone; ${bot.inventory.emptySlotCount()} free slots`)
}
// Save the iron pickaxe for ore that needs it; dig stone with stone pickaxes,
// crafting a new one (carried table, sticks, cobble) when the last one breaks.
const NEEDS_IRON = /^(deepslate_)?(diamond|gold|redstone|emerald)_ore$/
async function equipFor (b) {
  if (!NEEDS_IRON.test(b.name) && b.harvestTools) {
    if (!n('stone_pickaxe') && n('stick') >= 2 && n('crafting_table') && (n('cobblestone') >= 3 || n('cobbled_deepslate') >= 3) && Date.now() > (globalThis.pickRetry ?? 0)) {
      const made = await lib.obtain_item({ item: 'stone_pickaxe' })
      log('spare pickaxe: ' + made.summary)
      if (!made.ok) globalThis.pickRetry = Date.now() + 60000
    }
    const stone = bot.inventory.items().find(i => i.name === 'stone_pickaxe')
    if (stone && b.harvestTools[stone.type]) { await bot.equip(stone, 'hand'); return }
  }
  await bot.tool.equipForBlock(b, {})
  // Replace the iron pickaxe before it breaks (needs 3 iron carried).
  const held = bot.heldItem
  if (held?.name === 'iron_pickaxe' && held.maxDurability - (held.durabilityUsed ?? 0) < 15 && n('raw_iron') + n('iron_ingot') >= 3 && !globalThis.makingPick) {
    globalThis.makingPick = true
    try { log('iron pickaxe nearly worn out; making another'); await craftIronPickaxe() } finally { globalThis.makingPick = false }
    await bot.tool.equipForBlock(b, {})
  }
}
// bot.dig and pathfinder.goto can hang on 26.3 when the server disputes a block; bound both.
function timed (promise, ms, onTimeout) {
  let t
  return Promise.race([promise.finally(() => clearTimeout(t)), new Promise((resolve, reject) => { t = setTimeout(() => { onTimeout(); reject(new Error(`timed out after ${ms} ms`)) }, ms) })])
}
const dig = b => timed(bot.dig(b, true), 12000, () => { try { bot.stopDigging() } catch {} })
async function digAt (p) {
  const b = bot.blockAt(p)
  if (!b || ['air', 'cave_air', 'void_air'].includes(b.name)) return true
  if (nearLiquid(p) || LIQUID.has(b.name)) { why = `liquid next to ${b.name} at ${p}`; return false }
  if (b.name === 'bedrock') { why = 'bedrock'; return false }
  await equipFor(b)
  // Ore needs the right pickaxe to drop anything; other blocks (snow, leaves) can just be broken.
  if (b.name.endsWith('_ore') && !b.canHarvest(bot.heldItem?.type ?? null)) { why = `cannot harvest ${b.name}`; return false }
  // A dig the server did not accept leaves the block in place; stepping into it suffocates.
  for (let tryNo = 0; tryNo < 3; tryNo++) {
    try { await dig(bot.blockAt(p)) } catch (e) { if (tryNo === 2) { why = 'dig: ' + e.message; return false } }
    await bot.waitForTicks(2)
    if (!solid(bot.blockAt(p))) return true
  }
  why = `${bot.blockAt(p)?.name} at ${p} did not break`
  return false
}
async function moveTo (p) {
  try {
    await timed(bot.pathfinder.goto(new goals.GoalBlock(p.x, p.y, p.z)), 15000, () => bot.pathfinder.setGoal(null))
    return true
  } catch (e) { why = 'move: ' + e.message; return false }
}
// Below 8 health: wall in on all sides, eat and wait to heal if there is food.
// With no food keep working (dying is fine; the job reruns after respawn).
const retreat = false
async function safety () {
  if (bot.health >= 8) return true
  const p = bot.entity.position.floored()
  const fill = () => ['cobblestone', 'dirt', 'granite', 'diorite', 'andesite', 'cobbled_deepslate'].map(x => bot.inventory.items().find(i => i.name === x)).find(Boolean)
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1], [0, 2, 0]]) {
    const t = p.offset(dx, dy, dz)
    if (solid(bot.blockAt(t)) || !fill()) continue
    const ref = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].map(([a, b, c]) => bot.blockAt(t.offset(a, b, c))).find(b => solid(b) && !b.position.equals(p) && !b.position.equals(p.offset(0, 1, 0)))
    if (!ref) continue
    await bot.equip(fill(), 'hand')
    try { await bot.placeBlock(ref, t.minus(ref.position)) } catch {}
  }
  log(`health ${Math.round(bot.health)}: walled in to recover`)
  const until = Date.now() + 120000
  while (bot.health < 16 && Date.now() < until) { await eatIfHungry(18); if (bot.food < 18 && !bot.inventory.items().some(i => FOODS.includes(i.name))) break; await sleep(2000) }
  if (bot.health < 8 && !globalThis.saidHurt) { bot.chat('I am hurt and out of food, but I am going to keep mining'); globalThis.saidHurt = true }
  return true
}
// One step forward (dy = 0) or one stair down (dy = -1).
async function step (dy) {
  if (retreat || !(await safety())) { why = 'retreating: low health'; return false }
  const p = bot.entity.position.floored()
  const q = p.plus(dir).offset(0, dy, 0)
  const toClear = dy < 0 ? [p.plus(dir).offset(0, 1, 0), p.plus(dir), q] : [q.offset(0, 1, 0), q]
  for (const c of toClear) if (!(await digAt(c))) return false
  const floor = bot.blockAt(q.offset(0, -1, 0))
  if (!solid(floor)) {
    if (LIQUID.has(floor?.name) || nearLiquid(q.offset(0, -1, 0))) { why = `liquid under ${q}`; return false }
    // Keep cobblestone for new pickaxes; fill with the junk stone first.
    const fill = ['dirt', 'granite', 'diorite', 'andesite', 'tuff', 'cobbled_deepslate', 'cobblestone'].map(name => bot.inventory.items().find(i => i.name === name)).find(Boolean)
    if (!fill) { why = 'no block to fill a gap in the floor'; return false }
    // A solid face-neighbour of the gap (below it or beside it) to place against.
    const ref = [q.offset(0, -2, 0), q.offset(1, -1, 0), q.offset(-1, -1, 0), q.offset(0, -1, 1), q.offset(0, -1, -1)].map(r => bot.blockAt(r)).find(solid)
    if (!ref) { why = `open drop under ${q} (cave)`; return false }
    await bot.equip(fill, 'hand')
    const target = q.offset(0, -1, 0)
    try { await bot.placeBlock(ref, target.minus(ref.position)) } catch (e) { why = 'fill: ' + e.message; return false }
  }
  if (!(await moveTo(q))) return false
  steps++
  if (steps % 12 === 0 && n('torch')) {
    const under = bot.blockAt(p.offset(0, -1, 0))
    if (solid(under) && bot.blockAt(p)?.name.endsWith('air')) { await bot.equip(bot.inventory.items().find(i => i.name === 'torch'), 'hand'); try { await bot.placeBlock(under, new Vec3(0, 1, 0)) } catch {} }
  }
  return true
}
async function turn () { dir = DIRS[(DIRS.indexOf(dir) + 1 + (Math.random() < 0.5 ? 0 : 2)) % 4]; log(`blocked (${why}); turning to ${dir}`) }
const dirName = d => ['east', 'south', 'west', 'north'][DIRS.findIndex(x => x.equals(d))]
const dirOf = name => DIRS[['east', 'south', 'west', 'north'].indexOf(name)] ?? DIRS[0]
async function collectVisibleOres () {
  for (const ore of ORES) {
    if (ore !== 'diamond' && ore !== 'iron' && ore !== 'coal' && Math.random() < 0.5) continue
    const names = [`${ore}_ore`, `deepslate_${ore}_ore`].filter(x => bot.registry.blocksByName[x])
    const ids = names.map(x => bot.registry.blocksByName[x].id)
    const seen = bot.findBlocks({ matching: ids, maxDistance: 6, count: 8 }).map(p => bot.blockAt(p)).filter(b => b && bot.canSeeBlock(b) && !nearLiquid(b.position))
    if (!seen.length) continue
    if (ore === 'diamond' && pickTier() !== 'iron') { log('diamonds seen but no iron pickaxe yet'); continue }
    const r = await lib.gather_blocks({ block: ore, count: seen.length, maxDistance: 7 })
    found[ore] = (found[ore] ?? 0) + (r.observations?.collected ?? 0)
    log(`${ore}: ${r.summary}`)
    if (ore === 'diamond' && r.observations?.collected) bot.chat(`found diamonds! I have ${n('diamond')} now`)
  }
}
// Waypoints along the staircase (every 6 stairs), saved in the KB so later trips
// walk the stairs in short hops; one long path down makes the pathfinder give up.
globalThis.minePath ??= []
async function savePath () {
  await lib.save_location({ name: `${mine}_path`, note: JSON.stringify(globalThis.minePath), ...globalThis.minePath.at(-1) })
}
async function descendTo (y) {
  let fails = 0; let stairs = 0
  while (bot.entity.position.y > y + 0.5 && Date.now() < end && !retreat) {
    if (await step(-1)) {
      fails = 0
      if (++stairs % 6 === 0) { const p = bot.entity.position.floored(); globalThis.minePath.push({ x: p.x, y: p.y, z: p.z }); await savePath(); await light() }
      if (steps % 4 === 0) { await collectVisibleOres(); await eatIfHungry(); await dropJunk() }
    } else {
      await turn()
      if (++fails > 12) return false
      // Boxed in (cave, water): tunnel sideways a few blocks, then try down again.
      if (fails % 4 === 0) { log('boxed in; moving sideways'); for (let k = 0; k < 6; k++) if (!(await step(0))) await turn() }
    }
  }
  return true
}
async function tunnel (until, maxSteps) {
  let fails = 0
  for (let i = 0; i < maxSteps && !until() && Date.now() < end && !retreat; i++) {
    if (await step(0)) { fails = 0; await collectVisibleOres(); if (steps % 8 === 0) { await eatIfHungry(); await dropJunk() } } else { await turn(); if (++fails > 8) return }
  }
}

const FOODS = ['cooked_beef', 'cooked_porkchop', 'cooked_mutton', 'cooked_chicken', 'cooked_rabbit', 'cooked_cod', 'cooked_salmon', 'bread', 'baked_potato', 'apple', 'carrot']
const foodCount = () => bot.inventory.items().filter(i => FOODS.includes(i.name)).reduce((t, i) => t + i.count, 0)
// Health only regenerates at food 18+, so eat to 18 while recovering.
async function eatIfHungry (below = 16) {
  if (bot.food >= below) return
  const f = bot.inventory.items().find(i => FOODS.includes(i.name))
  if (!f) { if (!globalThis.askedFood) { bot.chat('Could someone bring me some food? I am mining'); globalThis.askedFood = true } return }
  await lib.eat_food({ item: f.name }) // bot.consume times out on 26.3
}
// Suffocation guard: hurt while the head is inside a block (gravel, a dig the
// server rejected) -> dig that block out at once.
lib.on('health', () => {
  const head = bot.entity.position.offset(0, 1.6, 0).floored()
  const b = bot.blockAt(head)
  // Only real walls suffocate; never dig doors, gates, fences, glass or other building parts.
  const passable = /door|gate|fence|pane|bars|ladder|sign|torch|carpet|slab|stairs|wall|glass|chest|bed|table|furnace|barrel|lantern|button|lever|plate/
  if (solid(b) && b.name !== 'bedrock' && !passable.test(b.name) && bot.entity.position.y < 50 && !globalThis.unsuffocating) {
    globalThis.unsuffocating = true
    log(`suffocating in ${b.name}; digging out`)
    dig(b).catch(() => {}).finally(() => { globalThis.unsuffocating = false })
  }
})
await dropJunk()
// Prep at the surface: minimal (bulk cobblestone prep only quarried pits);
// the staircase supplies stone and equipFor crafts replacement pickaxes.
if (bot.entity.position.y > ironY + 5) {
  for (const [item, k] of [['crafting_table', 1], ['stick', 16], ['stone_pickaxe', 1], ['torch', 24]]) {
    const have = item === 'log' ? bot.inventory.items().filter(i => i.name.endsWith('_log')).reduce((t, i) => t + i.count, 0) : n(item)
    if (have < k) { log(`prep ${item} x${k}...`); log(`prep ${item}: ${(await lib.obtain_item({ item, count: k })).summary}`) }
  }
  // Take food from the base food chest (kept stocked by the hunter) before leaving.
  if (foodCount() < food) {
    const saved = await lib.recall_location({ name: 'food_chest' })
    const chest = args.foodChest ?? (saved.ok ? saved.observations.location.position : baseChest)
    const go = await lib.navigate_to({ x: chest.x, y: chest.y, z: chest.z, range: 3 })
    let inv = go.ok ? await lib.inspect_container({ x: chest.x, y: chest.y, z: chest.z }) : go
    // Another bot may have the chest open; try again shortly.
    if (go.ok && !inv.ok) { await sleep(3000); inv = await lib.inspect_container({ x: chest.x, y: chest.y, z: chest.z }) }
    if (!inv.ok) log('food chest: ' + inv.summary)
    for (const f of FOODS) {
      const k = Math.min(inv.ok ? inv.observations.contents[f] ?? 0 : 0, food - foodCount())
      if (k > 0) log(`take ${f}: ${(await lib.withdraw_items({ item: f, count: k, x: chest.x, y: chest.y, z: chest.z })).summary}`)
    }
    log(`carrying ${foodCount()} food`)
  }
  // Hunt only by day; at night the surface is the dangerous part, and hunger alone
  // cannot kill a bot here, so go underground and mine instead.
  const t = bot.time.timeOfDay
  const daytime = t > 1000 && t < 12000
  if (foodCount() < 4 && !daytime) log('little food and it is night: skipping the hunt, mining instead')
  if (foodCount() < 4 && daytime) {
    log('not enough food; hunting a little first')
    const hunt = await helpers.huntNearby({ maxKills: 2, radius: 48, seconds: 90 })
    for (const [raw, cooked] of [['beef', 'cooked_beef'], ['porkchop', 'cooked_porkchop'], ['mutton', 'cooked_mutton'], ['chicken', 'cooked_chicken'], ['rabbit', 'cooked_rabbit']]) {
      if (n(raw)) log(`cook ${raw}: ${(await lib.obtain_item({ item: cooked, count: n(cooked) + n(raw) })).summary}`)
    }
    log(`food: hunt ${hunt.kills} kills; carrying ${foodCount()}`)
  }
  // No iron pickaxe yet: take iron from the base chest (earlier trips store it) and craft one up here.
  if (pickTier() !== 'iron') {
    const inv = await lib.inspect_container({ x: chest.x, y: chest.y, z: chest.z })
    const have = inv.ok ? inv.observations.contents ?? {} : {}
    for (const item of ['iron_ingot', 'raw_iron']) {
      const k = Math.min(have[item] ?? 0, Math.max(0, 3 - n('iron_ingot') - n('raw_iron')))
      if (k > 0) log(`take ${item}: ${(await lib.withdraw_items({ item, count: k, x: chest.x, y: chest.y, z: chest.z })).summary}`)
    }
    if (n('raw_iron') + n('iron_ingot') >= 3) await craftIronPickaxe()
  }
  // Armor: iron from earlier trips becomes a chestplate and helmet (keep 3 iron for pickaxes).
  const worn = slot => bot.inventory.slots[slot]?.name ?? ''
  const ARMOR = [['iron_chestplate', 8, 'torso', 6], ['iron_helmet', 5, 'head', 5], ['iron_leggings', 7, 'legs', 7], ['iron_boots', 4, 'feet', 8]]
  const need = ARMOR.filter(([, , , slot]) => !worn(slot).includes('iron') && !worn(slot).includes('diamond'))
  if (need.length) {
    await dropJunk()
    const inv = await lib.inspect_container({ x: chest.x, y: chest.y, z: chest.z })
    const spare = Math.max(0, (inv.ok ? (inv.observations.contents?.raw_iron ?? 0) + (inv.observations.contents?.iron_ingot ?? 0) : 0) - 3)
    let budget = spare + Math.max(0, n('raw_iron') + n('iron_ingot') - 3)
    log(`armor: need ${need.map(a => a[0]).join(', ')}; iron budget ${budget} (chest ${inv.ok ? 'ok' : inv.summary})`)
    for (const [item, cost, dest] of need) {
      if (budget < cost) break
      const have = n('raw_iron') + n('iron_ingot')
      for (const ore of ['iron_ingot', 'raw_iron']) {
        const k = Math.min(inv.observations?.contents?.[ore] ?? 0, cost + 3 - (n('raw_iron') + n('iron_ingot')))
        if (k > 0 && have < cost + 3) await lib.withdraw_items({ item: ore, count: k, x: chest.x, y: chest.y, z: chest.z })
      }
      const made = await lib.obtain_item({ item })
      log(`armor ${item}: ${made.summary}`)
      if (made.ok) { await lib.equip_item({ item, destination: dest }); budget -= cost }
    }
  }
  // Heal before going down: eat to 18 food and let health regenerate.
  for (let i = 0; i < 45 && bot.health < 16; i++) { await eatIfHungry(18); if (bot.food < 18) break; await sleep(2000) }
  bot.chat('heading down to mine for diamonds')
}
// After a night respawn at world spawn, crossing the surface to the mine is a
// death loop. Shelter until dawn unless already at (or inside) the mine, or
// people are playing: then keep mining through the night (dying is fine).
{
  const t = bot.time.timeOfDay
  const entranceNow = await place(mine)
  const far = !entranceNow || bot.entity.position.distanceTo(entranceNow) > 24
  if ((t > 12600 || t < 500) && bot.entity.position.y > 50 && far && !humans().length) {
    bot.chat('it is night and I respawned far from the mine; hiding until dawn, then back to mining')
    while (Date.now() < end) { const tt = bot.time.timeOfDay; if (tt > 500 && tt < 12600) break; await lib.shelter(); await sleep(5000) }
  }
}
// ---- The mine ---------------------------------------------------------------
let entrance = await place(mine)
let bottom = await place(`${mine}_bottom`)
let face = await place(`${mine}_face`)
if (face && face.y > ironY) face = null // a face saved at the surface by an older version
// A site is good when the first 10 stairs down from it are dry (no water or
// lava in or around the stair blocks). Only loaded chunks can be checked.
const WET = new Set(['water', 'lava', 'seagrass', 'kelp', 'kelp_plant', 'tall_seagrass'])
function siteOk (top, d) {
  for (let k = 1; k <= 10; k++) {
    const q = top.plus(d.scaled(k)).offset(0, -k, 0)
    for (const [x, y, z] of [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const b = bot.blockAt(q.offset(x, y, z))
      if (!b || WET.has(b.name)) return false
    }
  }
  return true
}
function surfaceAt (x, z) {
  for (let y = 100; y > 40; y--) {
    const b = bot.blockAt(new Vec3(x, y, z))
    if (b && b.boundingBox === 'block' && !WET.has(b.name) && !b.name.includes('leaves') && !b.name.endsWith('_log')) return new Vec3(x, y + 1, z)
    if (b && WET.has(b.name)) return null
  }
  return null
}
if (entrance) {
  const saved = (await lib.recall_location({ name: mine })).observations?.location?.note?.match(/dir (\w+)/)?.[1]
  if (!bottom && bot.entity.position.distanceTo(entrance) < 64 && !siteOk(entrance, dirOf(saved ?? 'north'))) {
    log(`saved mine entrance ${entrance} is wet; choosing a new site`)
    entrance = null; face = null
  }
}
if (!entrance) {
  // Start the staircase 24-40 blocks from base, outside the protected area, on dry land.
  let spot = null; let d = DIRS[3]
  if (bot.entity.position.distanceTo(new Vec3(base.x, bot.entity.position.y, base.z)) > 80) {
    log('to base first: ' + (await lib.navigate_to({ x: base.x, y: base.y, z: base.z, range: 6, walkOnly: bot.entity.position.y > 55 })).summary)
  }
  search: for (const r of siteRadius) for (const dd of DIRS) for (const off of [0, 6, -6]) {
    const side = DIRS[(DIRS.indexOf(dd) + 1) % 4]
    const xz = new Vec3(base.x, 0, base.z).plus(dd.scaled(r)).plus(side.scaled(off))
    const top = surfaceAt(xz.x, xz.z)
    if (top && siteOk(top, dd)) { spot = top; d = dd; break search }
  }
  if (!spot) {
    bot.chat('I could not find dry ground for the mine near base; trying again next run')
    return { diamonds: n('diamond'), note: 'no dry mine site found in loaded chunks; rerun near base' }
  }
  log(`dry mine site at ${spot}, stairs heading ${dirName(d)}`)
  // From underground the bot must be allowed to dig its way up; on the surface walk only.
  for (let tryNo = 0; tryNo < 4 && bot.entity.position.distanceTo(spot) > 4; tryNo++) {
    const go = await lib.navigate_to({ x: spot.x, y: spot.y, z: spot.z, range: 2, walkOnly: bot.entity.position.y > 55 })
    log('to mine site: ' + go.summary)
  }
  if (bot.entity.position.distanceTo(spot) > 6 || bot.entity.position.y < 55) {
    bot.chat('I could not reach the mine site yet; trying again next run')
    return { diamonds: n('diamond'), note: 'not at the mine site yet; rerun', at: bot.entity.position.floored() }
  }
  entrance = bot.entity.position.floored()
  globalThis.mineDirName = dirName(d)
  await remember(mine, entrance, `entrance of the diamond mine staircase, dir ${dirName(d)}`)
  bot.chat(`starting our diamond mine at ${entrance.x} ${entrance.y} ${entrance.z}`)
}
// The staircase direction is stored in the entrance note ("dir north").
const mdir = dirOf(globalThis.mineDirName ?? (await lib.recall_location({ name: mine })).observations?.location?.note?.match(/dir (\w+)/)?.[1] ?? 'north')
const side = [DIRS[(DIRS.indexOf(mdir) + 1) % 4], DIRS[(DIRS.indexOf(mdir) + 3) % 4]]

// A pickaxe first; craft a stone one from the staircase cobblestone if needed.
if (pickTier() === 'none' || pickTier() === 'wood') log('pickaxe: ' + (await lib.obtain_item({ item: 'stone_pickaxe' })).summary)

// Respawn here, not at world spawn: click the bed saved next to the mine once.
if (!globalThis.spawnSetAt) {
  const bedAt = await place(`${mine}_bed`)
  if (bedAt && bot.entity.position.distanceTo(bedAt) < 40 && bot.entity.position.y > 50) {
    await lib.navigate_to({ x: bedAt.x, y: bedAt.y, z: bedAt.z, range: 2 })
    const bed = bot.blockAt(bedAt)
    if (bed?.name.endsWith('_bed')) {
      try { await bot.activateBlock(bed) } catch (e) { log('bed: ' + e.message) }
      globalThis.spawnSetAt = bedAt
      log(`respawn point set at the mine bed ${bedAt}`)
    }
  }
}
// Go down: walk the saved staircase waypoints in short hops, then to the face.
const savedPath = (await lib.recall_location({ name: `${mine}_path` })).observations?.location?.note
if (savedPath) { try { globalThis.minePath = JSON.parse(savedPath) } catch {} }
async function hop (p, range = 1) {
  for (let t = 0; t < 2; t++) { const r = await lib.navigate_to({ x: p.x, y: p.y, z: p.z, range }); if (r.ok) return true; why = r.summary }
  return false
}
async function walkPath (points) {
  for (const p of points) { if (!(await hop(p))) { log(`stuck on the stairs near ${JSON.stringify(p)}: ${why}`); return false } await light() }
  return true
}
const deepTarget = face ?? bottom
if (bot.entity.position.y > diamondY + 3 && globalThis.minePath.length) {
  // Start from the waypoint nearest to where we are (resumes mid-staircase too).
  const here = bot.entity.position
  let i0 = 0; let best = Infinity
  globalThis.minePath.forEach((p, i) => { const d = here.distanceTo(new Vec3(p.x, p.y, p.z)); if (d < best) { best = d; i0 = i } })
  if (best > 12 && entrance) { log('to entrance: ' + (await lib.navigate_to({ x: entrance.x, y: entrance.y, z: entrance.z, range: 1 })).summary); i0 = 0 }
  log(`walking down ${globalThis.minePath.length - i0} staircase waypoints`)
  if (await walkPath(globalThis.minePath.slice(i0)) && deepTarget) log('to face: ' + (await hop(deepTarget) ? 'ok' : why))
} else if (deepTarget && bot.entity.position.y > diamondY + 3) {
  log(`walking down the mine to ${deepTarget}`)
  log('down: ' + (await hop(deepTarget) ? 'ok' : why))
}
if (bot.entity.position.y > diamondY + 0.5) {
  const last = globalThis.minePath.at(-1)
  if (last && bot.entity.position.y > last.y + 2) {
    log('to the end of the staircase: ' + ((await walkPath(globalThis.minePath)) ? 'ok' : why))
  } else if (!last && bot.entity.position.distanceTo(entrance) > 4 && bot.entity.position.y > 50) {
    log('to entrance: ' + (await lib.navigate_to({ x: entrance.x, y: entrance.y, z: entrance.z, range: 1 })).summary)
  }
  dir = mdir
  log(`digging the staircase ${dirName(dir)} to y ${diamondY}`)
  await descendTo(diamondY)
  if (bot.entity.position.y <= diamondY + 0.5) {
    bottom = bot.entity.position.floored()
    await remember(`${mine}_bottom`, bottom, 'bottom of the diamond mine staircase')
  }
}

// Never branch-mine near the surface (it would dig up the land around the base).
if (bot.entity.position.y > ironY) {
  log(`still at y ${Math.round(bot.entity.position.y)}; the staircase is not finished, rerun to continue`)
  return { diamonds: n('diamond'), y: Math.round(bot.entity.position.y), note: 'staircase not finished; rerun' }
}
// Iron pickaxe: branch-mine at depth until 3 iron (iron is common down to y -24 and visible in branch walls).
async function branchMine (until, maxBranches) {
  for (let b = 0; b < maxBranches && !until() && Date.now() < end; b++) {
    dir = mdir
    for (let k = 0; k < branchSpacing; k++) if (await step(0)) await collectVisibleOres(); else break
    const main = bot.entity.position.floored()
    face = main
    await remember(`${mine}_face`, face, `working face of the branch mine, branch ${b}`)
    for (const s of side) {
      dir = s
      for (let k = 0; k < branchLength && !until(); k++) { if (!(await step(0))) break; await collectVisibleOres() }
      await lib.navigate_to({ x: main.x, y: main.y, z: main.z, range: 0 })
    }
    await eatIfHungry(); await dropJunk()
    log(`branch ${b} done at ${main}: ${n('diamond')} diamonds, ${n('raw_iron') + n('iron_ingot')} iron`)
  }
}
if (pickTier() !== 'iron') {
  await branchMine(() => n('raw_iron') + n('iron_ingot') >= 3, 12)
  if (n('raw_iron') + n('iron_ingot') >= 3) await craftIronPickaxe()
}
if (pickTier() === 'iron') await branchMine(() => n('diamond') >= count, 30)

// ---- Home: up the stairs, into the base, diamonds and ores into the chest ----
const got = n('diamond')
log(`mining done: ${got} diamonds, found ${JSON.stringify(found)}; heading to the base chest`)
bot.pathfinder.setGoal(null)
// Climbing out costs minutes: only go home with enough diamonds or a full inventory.
if (got < count && bot.inventory.emptySlotCount() > 4 && bot.entity.position.y <= ironY) {
  log(`staying at the face: ${got}/${count} diamonds, ${bot.inventory.emptySlotCount()} free slots; rerun to keep mining`)
  return { diamonds: got, found, steps, pickaxe: pickTier(), note: 'still mining at the face; rerun' }
}
if (got > 0 || Date.now() < end) {
  if (entrance && bot.entity.position.y < entrance.y - 3) {
    if (globalThis.minePath.length) {
      const here = bot.entity.position
      let i0 = globalThis.minePath.length - 1; let best = Infinity
      globalThis.minePath.forEach((p, i) => { const d = here.distanceTo(new Vec3(p.x, p.y, p.z)); if (d < best) { best = d; i0 = i } })
      log(`climbing ${i0 + 1} staircase waypoints`)
      await walkPath(globalThis.minePath.slice(0, i0 + 1).reverse())
    }
    log('up: ' + ((await goTowards(entrance)) ? 'at the entrance' : 'still below the entrance'))
  }
  log('to chest: ' + ((await goTowards(new Vec3(chest.x, chest.y, chest.z), 3)) ? 'ok' : 'not there'))
  const stored = {}
  for (const item of ['diamond', 'raw_iron', 'iron_ingot', 'raw_gold', 'gold_ingot', 'coal', 'redstone', 'lapis_lazuli', 'emerald', 'raw_copper']) {
    if (!n(item)) continue
    // Keep coal for torches/smelting and 3 iron while there is no iron pickaxe yet.
    // Keep coal for torches/smelting and 3 iron for the next iron pickaxe.
    const keep = item === 'coal' ? Math.min(8, n(item)) : ['raw_iron', 'iron_ingot'].includes(item) ? Math.max(0, Math.min(n(item), 3 - (item === 'raw_iron' ? n('iron_ingot') : 0))) : 0
    if (n(item) - keep <= 0) continue
    const r = await lib.deposit_items({ item, count: n(item) - keep, x: chest.x, y: chest.y, z: chest.z })
    if (r.ok) stored[item] = r.observations?.deposited ?? r.observations?.count ?? true
    log(`deposit ${item}: ${r.summary}`)
  }
  if (Object.keys(stored).length) bot.chat(`back at base: put ${Object.entries(stored).map(([k, v]) => `${v === true ? '' : v + ' '}${k}`).join(', ')} in the chest at ${chest.x} ${chest.y} ${chest.z}`)
  return { diamonds: got, stored, found, steps, pickaxe: pickTier() }
}
return { diamonds: got, found, steps, pickaxe: pickTier(), y: Math.round(bot.entity.position.y), note: 'out of time; rerun to continue' }
```
