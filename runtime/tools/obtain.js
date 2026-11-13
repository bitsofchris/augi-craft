// obtain_item: "get me X". Plans backwards from the item: gather raw blocks,
// smelt, or craft from a recipe, obtaining ingredients, tools, a crafting
// table and a furnace on the way. Every step is one of the tested handlers
// (gather_blocks, smelt_item, craft_item), so verification stays theirs.
// When wood is needed and no tree is in range, it walks until it finds some.
import { ErrorCategory, ToolError, fail, inventoryCounts, ok } from './result.js'
import { gatherBlocks } from './gather.js'
import { craftItem, recipeNeeds, missingFor, campfireFuelVariants } from './craft.js'
import { smeltItem, chooseFuel } from './smelt.js'
import { findBlocks, requireItem } from './world.js'
import { goNear, gotoWithProgress } from './navigate.js'
import pathfinderPkg from 'mineflayer-pathfinder'
import { Vec3 } from 'vec3'

const { goals } = pathfinderPkg

/** Items that come from mining a block, with the gather_blocks alias to use. */
export const GATHER = {
  cobblestone: 'cobblestone', cobbled_deepslate: 'deepslate', dirt: 'dirt', sand: 'sand', red_sand: 'red_sand',
  gravel: 'gravel', clay_ball: 'clay', coal: 'coal', raw_iron: 'iron', raw_copper: 'copper', raw_gold: 'gold',
  diamond: 'diamond', redstone: 'redstone', lapis_lazuli: 'lapis_lazuli', emerald: 'emerald',
  sugar_cane: 'sugar_cane', cactus: 'cactus', pumpkin: 'pumpkin', melon_slice: 'melon', bamboo: 'bamboo',
  snowball: 'snow_block', ice: 'ice', obsidian: 'obsidian', string: 'cobweb'
}

/** Smelted items and their furnace input ('log' means any log). */
export const SMELT_FROM = {
  iron_ingot: 'raw_iron', gold_ingot: 'raw_gold', copper_ingot: 'raw_copper', glass: 'sand', stone: 'cobblestone',
  smooth_stone: 'stone', brick: 'clay_ball', charcoal: 'log', dried_kelp: 'kelp', green_dye: 'cactus',
  cooked_beef: 'beef', cooked_porkchop: 'porkchop', cooked_chicken: 'chicken', cooked_mutton: 'mutton',
  cooked_rabbit: 'rabbit', cooked_cod: 'cod', cooked_salmon: 'salmon', baked_potato: 'potato'
}

/** Things obtain cannot make, with what to do instead. */
const ELSEWHERE = {
  beef: 'hunt cows (helpers.huntNearby)', porkchop: 'hunt pigs', chicken: 'hunt chickens', mutton: 'hunt sheep',
  rabbit: 'hunt rabbits', leather: 'hunt cows', feather: 'hunt chickens', string: 'kill spiders or break cobwebs',
  bone: 'kill skeletons', gunpowder: 'kill creepers', arrow: 'craft from flint, stick and feather',
  flint: 'mine gravel until flint drops', cod: 'fish', salmon: 'fish', white_wool: 'shear or hunt sheep',
  ender_pearl: 'kill endermen', blaze_rod: 'kill blazes in the Nether', egg: 'collect from chickens',
  wheat: 'farm wheat (lib.farm_wheat)', wheat_seeds: 'break grass or lib.farm_wheat', potato: 'farm or find potatoes', carrot: 'farm or find carrots', apple: 'break oak leaves'
}

const PICKAXES = ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe']
const TOOL_ORDER = ['wooden_', 'stone_', 'iron_', 'diamond_', 'copper_', 'golden_', 'netherite_']
// Recipe variants built from these need a trip deep underground or to another
// dimension; prefer the ordinary variant (cobblestone over cobbled_deepslate).
const EXOTIC = /^(cobbled_deepslate|blackstone|copper_ingot|raw_copper|crimson_|warped_|bamboo_|cherry_|pale_oak_)/
const GENERIC_TOOLS = ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']
const MAX_DEPTH = 10

const isLog = n => n.endsWith('_log') && !n.startsWith('stripped_')
const woodOf = n => n.replace(/_(log|planks|wood)$/, '')
const logCount = inv => Object.entries(inv).filter(([n]) => isLog(n)).reduce((s, [, c]) => s + c, 0)

export async function obtainItem (ctx, { item, count = 1, maxDistance = 64 }) {
  const { bot } = ctx
  const plan = { steps: [], active: new Set(), depth: 0, maxDistance, placed: [] }
  const name = normalize(bot, item, plan)
  const start = inventoryCounts(bot)
  const have = () => name === 'log' ? logCount(inventoryCounts(bot)) : (inventoryCounts(bot)[name] ?? 0)
  // Pathfinder scaffolding would spend gathered ingredients (cobblestone for a
  // furnace, planks for sticks). Only let it build with dirt while planning.
  const movements = bot.pathfinder?.movements
  const scaffolding = movements?.scafoldingBlocks
  if (movements && Array.isArray(scaffolding)) {
    const dirt = bot.registry.itemsByName.dirt?.id
    movements.scafoldingBlocks = scaffolding.filter(id => id === dirt)
  }
  try {
    await ensure(ctx, name, count, plan)
  } catch (err) {
    if (!(err instanceof ToolError)) throw err
    ctx.checkAbort()
    return fail(err.category, `Could not obtain ${count} ${name}: ${err.message}`, { have: have(), steps: plan.steps, ...err.observations })
  } finally {
    if (movements && Array.isArray(scaffolding)) movements.scafoldingBlocks = scaffolding
    await recollectStations(ctx, plan)
  }
  const gained = have() - (name === 'log' ? logCount(start) : (start[name] ?? 0))
  return ok(`Have ${have()} ${name}${gained > 0 ? ` (+${gained})` : ' (already had enough)'}`, { have: have(), steps: plan.steps })
}

/**
 * Pick up the crafting tables and furnaces this run placed, so a bot crafting
 * away from base (underground, on a trip) keeps its stations.
 */
async function recollectStations (ctx, plan) {
  const { bot } = ctx
  for (const { name, position } of plan.placed) {
    if (ctx.signal?.aborted) return
    const p = new Vec3(position.x, position.y, position.z)
    const block = bot.blockAt(p)
    if (block?.name !== name) continue
    try {
      await goNear(ctx, p, 2)
      if (bot.inventory.items().length) await bot.tool?.equipForBlock?.(block, {})
      await bot.dig(block)
      await bot.waitForTicks?.(15)
      plan.steps.push(`picked up the ${name} at ${p.x} ${p.y} ${p.z}`)
    } catch (err) {
      plan.steps.push(`left the ${name} at ${p.x} ${p.y} ${p.z}: ${err.message}`)
    }
  }
}

/** Turn loose names ("planks", "wood", "torches", "a sword") into an item. */
function normalize (bot, raw, plan) {
  let n = String(raw).trim().toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_')
  if (['log', 'logs', 'wood'].includes(n)) return 'log'
  if (n === 'planks' || n === 'plank') return `${preferredWood(bot, plan)}_planks`
  n = n.replace(/^(a|an|some)_/, '').replace(/^pick$/, 'pickaxe')
  for (const cut of [1, 2]) {
    if (!bot.registry.itemsByName[n] && n.endsWith('s') && bot.registry.itemsByName[n.slice(0, -cut)]) { n = n.slice(0, -cut); break }
  }
  if (GENERIC_TOOLS.includes(n)) n = `stone_${n}`
  return requireItem(bot.registry, n).name
}

/** Wood species to use: most logs in inventory, else the nearest tree, else oak. */
function preferredWood (bot, plan) {
  const inv = inventoryCounts(bot)
  const held = Object.entries(inv).filter(([n]) => isLog(n) || n.endsWith('_planks')).sort((a, b) => b[1] - a[1])[0]
  if (held) return woodOf(held[0])
  if (plan.wood) return plan.wood
  const logs = Object.keys(bot.registry.blocksByName).filter(isLog)
  const [tree] = findBlocks(bot, logs, { maxDistance: plan.maxDistance, count: 1 })
  plan.wood = tree ? woodOf(tree.name) : 'oak'
  return plan.wood
}

async function ensure (ctx, name, count, plan) {
  const { bot } = ctx
  const have = () => name === 'log' ? logCount(inventoryCounts(bot)) : (inventoryCounts(bot)[name] ?? 0)
  if (have() >= count) return
  ctx.checkAbort()
  if (plan.active.has(name)) throw new ToolError(ErrorCategory.MISSING_MATERIALS, `${name} depends on itself`)
  if (plan.depth >= MAX_DEPTH) throw new ToolError(ErrorCategory.MISSING_MATERIALS, `plan for ${name} is too deep`)
  plan.active.add(name); plan.depth++
  try {
    if (name === 'log' || isLog(name) || GATHER[name]) await gather(ctx, name, count, plan)
    else if (SMELT_FROM[name]) await smelt(ctx, name, count, plan)
    else await craft(ctx, name, count, plan)
  } finally {
    plan.active.delete(name); plan.depth--
  }
  if (have() < count) throw new ToolError(ErrorCategory.PARTIAL, `have ${have()}/${count} ${name}`)
}

async function gather (ctx, name, count, plan) {
  const { bot } = ctx
  const alias = name === 'log' ? 'log' : isLog(name) ? name : GATHER[name]
  const have = () => name === 'log' ? logCount(inventoryCounts(bot)) : (inventoryCounts(bot)[name] ?? 0)
  for (let attempt = 0; attempt < 4 && have() < count; attempt++) {
    const res = await gatherBlocks(ctx, { block: alias, count: count - have(), maxDistance: plan.maxDistance })
    plan.steps.push(`gather ${alias} x${count - have() + (res.observations?.collected ?? 0)}: ${res.summary}`)
    if (res.ok || have() >= count) return
    const category = res.error?.category
    if (category === ErrorCategory.MISSING_TOOL) {
      const tool = cheapestTool(bot, res.observations?.requiresOneOf ?? [], alias)
      if (!tool) throw new ToolError(category, res.summary)
      await ensure(ctx, tool, 1, plan)
      continue
    }
    if (category === ErrorCategory.PARTIAL) continue
    if (category === ErrorCategory.NOT_FOUND && name === 'log') {
      // A fresh spawn can be far from any tree: walk until some come into range.
      if (!await walkToTrees(ctx, plan)) throw new ToolError(ErrorCategory.NOT_FOUND, `no trees found after walking ${plan.walked} blocks; run again to keep searching from here`)
      continue
    }
    if ([ErrorCategory.NOT_FOUND, ErrorCategory.UNREACHABLE].includes(category) && isLog(name)) {
      // Any wood works for planks-based recipes: collect whatever trees are
      // near, so the caller can switch to that species' recipe variant.
      plan.wood = null
      let any = await gatherBlocks(ctx, { block: 'log', count: count - have(), maxDistance: plan.maxDistance })
      if (any.error?.category === ErrorCategory.NOT_FOUND && await walkToTrees(ctx, plan)) {
        any = await gatherBlocks(ctx, { block: 'log', count: count - have(), maxDistance: plan.maxDistance })
      }
      plan.steps.push(`no ${name} nearby; gather any log: ${any.summary}`)
      if (!any.ok && plan.walked !== undefined) throw new ToolError(ErrorCategory.NOT_FOUND, `no trees found after walking ${plan.walked} blocks; run again to keep searching from here`)
      throw new ToolError(ErrorCategory.NOT_FOUND, `no ${name} within ${plan.maxDistance} blocks`)
    }
    if (category === ErrorCategory.NOT_FOUND && ELSEWHERE[name]) {
      throw new ToolError(ErrorCategory.NOT_FOUND, `no ${alias} within ${plan.maxDistance} blocks; ${ELSEWHERE[name]}`)
    }
    if (category === ErrorCategory.NOT_FOUND && /_ore$|^(coal|iron|gold|copper|diamond|redstone|lapis_lazuli|emerald)$/.test(alias)) {
      throw new ToolError(ErrorCategory.NOT_FOUND, `no visible ${alias} ore within ${plan.maxDistance} blocks; go underground or into a cave first (see helpers for mining)`)
    }
    throw new ToolError(category ?? ErrorCategory.GAME_ERROR, res.summary)
  }
}

const TREE_SIGHT = 160 // about the loaded-chunk radius at the default view distance
const TREE_STEP = 32 // walk this far between searches (well inside maxDistance)
const TREE_WALK_MS = 150_000 // leaves the rest of obtain_item's 300 s for gathering and crafting

/**
 * Walk until any log is within plan.maxDistance: head for the nearest tree the
 * bot has loaded, else walk an outward square spiral, searching every
 * TREE_STEP blocks. Bounded by time, not distance; a rerun keeps searching
 * from wherever this left the bot. Returns true once trees are in range.
 */
async function walkToTrees (ctx, plan) {
  const { bot } = ctx
  const logs = Object.keys(bot.registry.blocksByName).filter(isLog)
  const inRange = () => findBlocks(bot, logs, { maxDistance: plan.maxDistance, count: 1 }).length > 0
  plan.walked ??= 0
  const start = bot.entity.position.clone()
  // Spiral steps target x/z only, so hills and valleys on the way don't matter.
  const walk = async (x, y, z, range) => {
    const from = bot.entity.position.clone()
    try {
      if (y === null) await gotoWithProgress(ctx, new goals.GoalNearXZ(x, z, range))
      else await goNear(ctx, { x, y, z }, range)
      return true
    } catch (err) {
      bot.pathfinder.stop?.()
      bot.pathfinder.setGoal?.(null)
      ctx.checkAbort()
      plan.steps.push(`could not walk toward ${Math.round(x)} ${Math.round(z)}: ${err.message}`)
      return false
    } finally {
      plan.walked += Math.round(from.distanceTo(bot.entity.position))
    }
  }
  const [far] = findBlocks(bot, logs, { maxDistance: TREE_SIGHT, count: 1 })
  if (far) {
    await walk(far.position.x, far.position.y, far.position.z, 4)
    if (inRange()) { plan.steps.push(`walked ${plan.walked} blocks to trees seen at ${far.position.x} ${far.position.z}`); return true }
  }
  const deadline = Date.now() + TREE_WALK_MS
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]]
  let failures = 0
  for (let leg = 0; Date.now() < deadline && failures < 8; leg++) {
    const [dx, dz] = dirs[leg % 4]
    const length = TREE_STEP * (Math.floor(leg / 2) + 1)
    for (let done = 0; done < length && Date.now() < deadline; done += TREE_STEP) {
      ctx.checkAbort()
      const p = bot.entity.position
      if (!await walk(Math.round(p.x + dx * TREE_STEP), null, Math.round(p.z + dz * TREE_STEP), 3)) { failures++; break }
      failures = 0
      if (inRange()) {
        plan.steps.push(`walked ${plan.walked} blocks looking for trees; found some ${Math.round(bot.entity.position.distanceTo(start))} blocks from the start`)
        return true
      }
    }
  }
  plan.steps.push(`walked ${plan.walked} blocks and found no trees`)
  return false
}

function cheapestTool (bot, names, alias) {
  const tools = names.length ? names : (alias && /ore|stone|cobble|deepslate|coal|iron|gold|diamond|redstone|lapis|emerald|obsidian/.test(alias) ? PICKAXES : [])
  const rank = n => { const i = TOOL_ORDER.findIndex(p => n.startsWith(p)); return i < 0 ? 99 : i }
  return [...tools].sort((a, b) => rank(a) - rank(b))[0] ?? null
}

async function smelt (ctx, name, count, plan) {
  const { bot } = ctx
  const source = SMELT_FROM[name]
  if (ELSEWHERE[source] && !(inventoryCounts(bot)[source] >= 1)) {
    throw new ToolError(ErrorCategory.NOT_FOUND, `${name} needs ${source}: ${ELSEWHERE[source]}`)
  }
  const have = () => inventoryCounts(bot)[name] ?? 0
  const concrete = () => source !== 'log' ? source
    : Object.entries(inventoryCounts(bot)).filter(([n]) => isLog(n)).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (findBlocks(bot, ['furnace'], { maxDistance: 16, count: 1 }).length === 0) await ensure(ctx, 'furnace', 1, plan)
  // Fuel first: making plank fuel can use up logs meant as the input.
  for (let attempt = 0; attempt < 3 && have() < count; attempt++) {
    const left = count - have()
    if (!chooseFuel(inventoryCounts(bot), concrete() ?? source, left)) await ensureFuel(ctx, left, plan)
    await ensure(ctx, source, left, plan)
    const input = concrete()
    const res = await smeltItem(ctx, { item: input, count: Math.min(left, inventoryCounts(bot)[input] ?? 0) })
    plan.steps.push(`smelt ${input} -> ${name} x${left}: ${res.summary}`)
    if (res.observations?.placedFurnace) plan.placed.push(res.observations.placedFurnace)
    if (!res.ok && ![ErrorCategory.PARTIAL, ErrorCategory.MISSING_MATERIALS].includes(res.error?.category)) {
      throw new ToolError(res.error?.category ?? ErrorCategory.GAME_ERROR, res.summary)
    }
  }
}

/** Fuel for `items` smelts: carried logs as planks, visible coal, then any wood. */
async function ensureFuel (ctx, items, plan) {
  const { bot } = ctx
  const options = []
  const carried = Object.entries(inventoryCounts(bot)).find(([n, c]) => isLog(n) && c > 0)
  if (carried) options.push([`${woodOf(carried[0])}_planks`, Math.ceil(items / 1.5)])
  options.push(['coal', Math.ceil(items / 8)])
  options.push([`${preferredWood(bot, plan)}_planks`, Math.ceil(items / 1.5)])
  let firstError = null
  for (const [fuel, n] of options) {
    try {
      await ensure(ctx, fuel, (inventoryCounts(bot)[fuel] ?? 0) + n, plan)
      return
    } catch (err) {
      if (!(err instanceof ToolError)) throw err
      firstError ??= err
      plan.steps.push(`fuel ${fuel} unavailable (${err.message})`)
    }
  }
  throw new ToolError(ErrorCategory.MISSING_MATERIALS, `no fuel for ${items} smelts: carry coal or logs (${firstError?.message})`)
}

async function craft (ctx, name, count, plan) {
  const { bot } = ctx
  const target = requireItem(bot.registry, name)
  const recipes = campfireFuelVariants(bot.registry, name, bot.recipesAll(target.id, null, true) ?? [])
  if (!recipes.length) {
    const hint = ELSEWHERE[name] ?? 'it has no recipe, smelting or mining source the planner knows'
    throw new ToolError(ErrorCategory.NOT_FOUND, `cannot make ${name}: ${hint}`)
  }
  const perCraft = recipes[0].result?.count ?? 1
  // Rank recipe variants by what is missing now; re-rank after a variant
  // fails, since the attempt may have gathered other materials (another wood).
  const ranked = () => {
    const wood = preferredWood(bot, plan)
    const inv = inventoryCounts(bot)
    const crafts = Math.ceil((count - (inv[name] ?? 0)) / perCraft)
    return recipes.map(r => {
      const needs = recipeNeeds(bot.registry, r, crafts)
      const missing = missingFor(needs, inv)
      let score = Object.values(missing).reduce((s, n) => s + n, 0)
      for (const ing of Object.keys(missing)) {
        if ((ing.endsWith('_planks') || isLog(ing)) && woodOf(ing) !== wood) score += 1000
        else if (EXOTIC.test(ing)) score += 800
        if (ELSEWHERE[ing]) score += 500
        if (ing === 'coal') score += 2 // charcoal from logs is more reliable than finding visible coal
      }
      return { r, needs, score }
    }).sort((a, b) => a.score - b.score)
  }

  let lastError = null
  const tried = new Set()
  for (let attempt = 0; attempt < 3; attempt++) {
    const next = ranked().find(v => !tried.has(v.r))
    if (!next) break
    tried.add(next.r)
    const { needs } = next
    try {
      // Crafting one ingredient can consume another (sticks eat planks), so loop.
      for (let pass = 0; pass < 4; pass++) {
        for (const [ing, n] of Object.entries(needs)) await ensure(ctx, ing, n, plan)
        if (Object.keys(missingFor(needs, inventoryCounts(bot))).length === 0) break
      }
      lastError = null
      break
    } catch (err) {
      if (!(err instanceof ToolError) || ![ErrorCategory.NOT_FOUND, ErrorCategory.UNREACHABLE, ErrorCategory.MISSING_TOOL].includes(err.category)) throw err
      ctx.checkAbort()
      lastError ??= err // report why the best variant failed, not the last fallback
      plan.steps.push(`recipe for ${name} blocked (${err.message}); trying another`)
    }
  }
  if (lastError) throw lastError

  for (let attempt = 0; attempt < 3; attempt++) {
    const left = count - (inventoryCounts(bot)[name] ?? 0)
    if (left <= 0) return
    if (bot.inventory.emptySlotCount?.() === 0 && !(inventoryCounts(bot)[name] > 0)) {
      throw new ToolError(ErrorCategory.INVENTORY_FULL, 'inventory is full; drop or store items (junk stone) before crafting')
    }
    const res = await craftItem(ctx, { item: name, count: left })
    plan.steps.push(`craft ${name} x${left}: ${res.summary}`)
    if (res.observations?.placedCraftingTable) plan.placed.push(res.observations.placedCraftingTable)
    if (res.ok) return
    const category = res.error?.category
    if (category === ErrorCategory.NO_STATION) { await ensure(ctx, 'crafting_table', 1, plan); continue }
    if (category === ErrorCategory.PARTIAL) continue
    if (category === ErrorCategory.MISSING_MATERIALS && res.observations?.missing) {
      for (const [ing, n] of Object.entries(res.observations.missing)) await ensure(ctx, ing, (inventoryCounts(bot)[ing] ?? 0) + n, plan)
      continue
    }
    throw new ToolError(category ?? ErrorCategory.GAME_ERROR, res.summary, res.observations)
  }
}
