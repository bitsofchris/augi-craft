// dig_tunnel: dig a 1x2 passage step by step (level, a staircase down, or a
// staircase up) and walk into it, stopping before lava, water, open drops,
// bedrock and storage. Reports every ore the tunnel uncovers. Where to dig, how
// far and why is the caller's decision; this only digs safely.
import { Vec3 } from 'vec3'
import pathfinderPkg from 'mineflayer-pathfinder'
import { ErrorCategory, fail, ok, roundPos } from './result.js'

const { goals } = pathfinderPkg

export const DIRECTIONS = { north: new Vec3(0, 0, -1), south: new Vec3(0, 0, 1), east: new Vec3(1, 0, 0), west: new Vec3(-1, 0, 0) }
const AIRS = new Set(['air', 'cave_air', 'void_air'])
const LIQUID = new Set(['lava', 'water'])
const NO_DIG = new Set(['bedrock', 'chest', 'trapped_chest', 'barrel', 'furnace', 'blast_furnace', 'smoker', 'crafting_table', 'spawner', 'end_portal_frame', 'obsidian'])
// Floor patches: never sand or gravel (they fall), never anything valuable.
const FILL = ['cobblestone', 'cobbled_deepslate', 'dirt', 'andesite', 'diorite', 'granite', 'tuff', 'netherrack', 'stone']
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]

const isOre = name => name.endsWith('_ore') || name === 'ancient_debris'
const solid = b => Boolean(b) && b.boundingBox === 'block' && !LIQUID.has(b.name)

/** Why digging out cell p would be unsafe, or null. Lava anywhere next to it, or water in it or above it. */
export function liquidHazard (bot, p) {
  const here = bot.blockAt(p)?.name
  if (LIQUID.has(here)) return `${here} at ${p}`
  for (const [x, y, z] of SIDES) {
    const n = bot.blockAt(p.offset(x, y, z))?.name
    if (n === 'lava') return `lava next to ${p}`
    if (n === 'water' && y === 1) return `water above ${p}`
  }
  return null
}

/** The cells to clear for one step from feet position p, and where the feet end up. */
export function stepCells (p, d, slope) {
  const ahead = p.plus(d)
  if (slope === 'down') return { clear: [ahead.offset(0, 1, 0), ahead, ahead.offset(0, -1, 0)], feet: ahead.offset(0, -1, 0) }
  if (slope === 'up') return { clear: [p.offset(0, 2, 0), ahead.offset(0, 1, 0), ahead.offset(0, 2, 0)], feet: ahead.offset(0, 1, 0) }
  return { clear: [ahead, ahead.offset(0, 1, 0)], feet: ahead }
}

async function clearCell (ctx, p) {
  const { bot } = ctx
  const b = bot.blockAt(p)
  if (!b || AIRS.has(b.name)) return null
  if (NO_DIG.has(b.name)) return { category: ErrorCategory.UNREACHABLE, why: `${b.name} at ${p}` }
  const hazard = liquidHazard(bot, p)
  if (hazard) return { category: ErrorCategory.UNREACHABLE, why: hazard }
  if (bot.inventory.items().length) await bot.tool?.equipForBlock?.(b, {})
  if (b.harvestTools && !b.canHarvest(bot.heldItem?.type ?? null)) return { category: ErrorCategory.MISSING_TOOL, why: `${b.name} needs a better tool` }
  for (let attempt = 0; attempt < 3; attempt++) {
    ctx.checkAbort()
    try { await bot.dig(bot.blockAt(p), true) } catch (err) { if (attempt === 2) return { category: ErrorCategory.GAME_ERROR, why: `dig ${b.name}: ${err.message}` } }
    await bot.waitForTicks?.(2)
    if (!solid(bot.blockAt(p))) return null
  }
  return { category: ErrorCategory.GAME_ERROR, why: `${b.name} at ${p} did not break` }
}

/** Make sure there is something to stand on under feet position f, patching a gap with a fill block. */
async function ensureFloor (ctx, f) {
  const { bot } = ctx
  const below = f.offset(0, -1, 0)
  const floor = bot.blockAt(below)
  if (solid(floor)) return null
  if (LIQUID.has(floor?.name) || liquidHazard(bot, below)) return { category: ErrorCategory.UNREACHABLE, why: `${floor?.name ?? 'liquid'} under ${f}` }
  const item = FILL.map(n => bot.inventory.items().find(i => i.name === n)).find(Boolean)
  const ref = SIDES.map(([x, y, z]) => bot.blockAt(below.offset(x, y, z))).find(b => solid(b) && !b.position.equals(f))
  if (!item) return { category: ErrorCategory.UNREACHABLE, why: `open drop under ${f} and no cobblestone or dirt to patch it` }
  if (!ref) return { category: ErrorCategory.UNREACHABLE, why: `open drop under ${f}: a cave or deep hole, nothing to build the floor against` }
  await bot.equip(item, 'hand')
  try { await bot.placeBlock(ref, below.minus(ref.position)) } catch (err) { return { category: ErrorCategory.GAME_ERROR, why: `patch floor: ${err.message}` } }
  return solid(bot.blockAt(below)) ? null : { category: ErrorCategory.GAME_ERROR, why: `floor under ${f} did not appear` }
}

async function walkInto (ctx, f) {
  const { bot } = ctx
  let timer
  try {
    await Promise.race([
      bot.pathfinder.goto(new goals.GoalBlock(f.x, f.y, f.z)),
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('timed out')), 10_000) })
    ])
  } catch (err) {
    bot.pathfinder.setGoal?.(null)
    return { category: ErrorCategory.UNREACHABLE, why: `could not step into ${f}: ${err.message}` }
  } finally { clearTimeout(timer) }
  return bot.entity.position.distanceTo(f.offset(0.5, 0, 0.5)) <= 1.5 ? null : { category: ErrorCategory.UNREACHABLE, why: `did not reach ${f}` }
}

/** Ores the bot can see within a few blocks (the tunnel walls and any cave it opened). */
function visibleOres (bot, radius = 5) {
  const ids = Object.values(bot.registry.blocksByName).filter(b => isOre(b.name)).map(b => b.id)
  return bot.findBlocks({ matching: ids, maxDistance: radius, count: 32 })
    .map(p => bot.blockAt(p)).filter(b => b && bot.canSeeBlock(b))
}

export async function digTunnel (ctx, { direction, length, slope = 'level', stopAtOre = false }) {
  const { bot } = ctx
  const d = DIRECTIONS[direction]
  bot.pathfinder?.setGoal?.(null)
  const start = bot.entity.position.floored()
  const ores = new Map()
  const seeOres = () => {
    let fresh = 0
    for (const b of visibleOres(bot)) {
      const k = b.position.toString()
      if (!ores.has(k)) { ores.set(k, { name: b.name, ...roundPos(b.position) }); fresh++ }
    }
    return fresh
  }
  seeOres()
  let steps = 0
  let stop = null
  for (; steps < length; steps++) {
    ctx.checkAbort()
    const p = bot.entity.position.floored()
    const { clear, feet } = stepCells(p, d, slope)
    for (const c of clear) { stop = await clearCell(ctx, c); if (stop) break }
    if (!stop) stop = await ensureFloor(ctx, feet)
    if (!stop) stop = await walkInto(ctx, feet)
    if (stop) break
    if (seeOres() && stopAtOre) { steps++; stop = { category: null, why: 'ore in sight' }; break }
  }
  const observations = {
    steps, direction, slope,
    from: roundPos(start), position: roundPos(bot.entity.position),
    oresSeen: [...ores.values()],
    stoppedBecause: stop?.why ?? null
  }
  const what = `${steps} step(s) ${slope === 'level' ? '' : slope + ' '}${direction}`
  if (!stop || stop.category === null) return ok(`Dug ${what}${stop ? ', stopped: ore in sight' : ''}; ${ores.size} ore block(s) seen`, observations)
  if (steps === 0) return fail(stop.category, `Could not dig ${direction}: ${stop.why}`, observations)
  return fail(ErrorCategory.PARTIAL, `Dug ${what}, then stopped: ${stop.why}`, observations)
}
