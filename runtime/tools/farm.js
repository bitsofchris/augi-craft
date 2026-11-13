// farm_wheat: one pass over a small wheat field. Harvest ripe wheat, gather
// seeds from grass when none are carried, till dirt next to the field with a
// hoe and plant seeds. Wheat regrows on its own, so repeated passes are a
// renewable food source (3 wheat -> 1 bread). Every change is verified by the
// block state or the inventory, not by the swing.
import { Vec3 } from 'vec3'
import { ErrorCategory, ToolError, fail, inventoryCounts, ok } from './result.js'
import { goNear } from './navigate.js'
import { obtainItem } from './obtain.js'

export const RIPE_AGE = 7
const SOIL = new Set(['dirt', 'grass_block', 'coarse_dirt', 'rooted_dirt', 'dirt_path'])
const GRASS = ['short_grass', 'grass', 'tall_grass', 'fern', 'large_fern']
const HOES = ['netherite_hoe', 'diamond_hoe', 'iron_hoe', 'golden_hoe', 'stone_hoe', 'wooden_hoe']
const OPEN = new Set(['air', 'cave_air', 'short_grass', 'grass', 'fern', 'snow'])

const ageOf = block => Number(block?.getProperties?.().age ?? 0)

/** Blocks of `names` within a box around `center`, closest to the center first. */
function blocksNear (bot, center, radius, names, dy = 1) {
  const out = []
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      for (let y = -dy; y <= dy; y++) {
        const b = bot.blockAt(center.offset(x, y, z))
        if (b && names.has(b.name)) out.push(b)
      }
    }
  }
  return out.sort((a, b) => a.position.distanceTo(center) - b.position.distanceTo(center))
}

/** Farmland stays moist within 4 blocks (horizontally) of water at its level or one above. */
export function nearWater (bot, p) {
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      for (const y of [0, 1]) if (bot.blockAt(p.offset(x, y, z))?.name === 'water') return true
    }
  }
  return false
}

async function waitFor (ctx, check, ticks = 20) {
  for (let t = 0; t < ticks; t++) {
    if (check()) return true
    ctx.checkAbort()
    await ctx.bot.waitForTicks(1)
  }
  return check()
}

async function equipNamed (bot, names) {
  const item = names.map(n => bot.inventory.items().find(i => i.name === n)).find(Boolean)
  if (item) await bot.equip(item, 'hand')
  return item
}

export async function farmWheat (ctx, { x, y, z, radius = 4, plots = 16, seconds = 150 }) {
  const { bot } = ctx
  if (!Number.isInteger(radius) || radius < 1 || radius > 8) return fail(ErrorCategory.INVALID_ARGUMENT, 'radius must be 1–8')
  const end = Date.now() + seconds * 1000
  const center = [x, y, z].every(Number.isInteger) ? new Vec3(x, y, z) : bot.entity.position.floored().offset(0, -1, 0)
  const start = inventoryCounts(bot)
  const have = name => inventoryCounts(bot)[name] ?? 0
  const done = { harvested: 0, tilled: 0, planted: 0, grassBroken: 0, errors: [] }
  const time = () => Date.now() < end
  const tryStep = async (what, fn) => {
    try { return await fn() } catch (err) {
      if (!(err instanceof ToolError) && /interrupted|aborted/i.test(err.message)) throw err
      ctx.checkAbort()
      done.errors.push(`${what}: ${err.message}`)
      return false
    }
  }

  // 1. Harvest ripe wheat; drops land on the block, so stand on it to collect.
  for (const crop of blocksNear(bot, center, radius, new Set(['wheat']), 2)) {
    if (!time()) break
    if (ageOf(crop) < RIPE_AGE) continue
    await tryStep(`harvest ${crop.position}`, async () => {
      await goNear(ctx, crop.position, 2)
      const before = have('wheat')
      await bot.dig(bot.blockAt(crop.position))
      if (!(await waitFor(ctx, () => have('wheat') > before, 10))) {
        await goNear(ctx, crop.position, 0)
        await waitFor(ctx, () => have('wheat') > before, 20)
      }
      if (have('wheat') > before) done.harvested++
    })
  }

  // 2. Seeds: grass drops them one time in eight.
  const want = Math.max(1, Math.min(plots, 8))
  if (have('wheat_seeds') === 0) {
    const ids = GRASS.map(n => bot.registry.blocksByName[n]?.id).filter(id => id !== undefined)
    for (let i = 0; i < 48 && have('wheat_seeds') < want && time(); i++) {
      const [p] = bot.findBlocks({ matching: ids, maxDistance: 32, count: 1 })
      if (!p) break
      const broke = await tryStep(`grass ${p}`, async () => {
        await goNear(ctx, p, 2)
        await bot.dig(bot.blockAt(p))
        done.grassBroken++
        await waitFor(ctx, () => false, 6)
        return true
      })
      if (!broke) break
    }
    // Drops may lie a block or two away; walk the field center to pick them up.
    if (have('wheat_seeds') === 0 && done.grassBroken) await tryStep('collect seeds', () => goNear(ctx, center, 1))
  }

  // 3. Plant seeds on empty farmland, tilling soil next to the field first.
  const farmland = () => blocksNear(bot, center, radius, new Set(['farmland']), 1)
    .filter(b => OPEN.has(bot.blockAt(b.position.offset(0, 1, 0))?.name))
  const field = () => blocksNear(bot, center, radius, new Set(['wheat']), 2).length
  if (have('wheat_seeds') > 0 && time()) {
    const bare = farmland().length
    const toTill = Math.max(0, Math.min(plots - field() - bare, have('wheat_seeds') - bare))
    // Snow layers cover grass in cold biomes; they are cleared before tilling.
    const feet = bot.entity.position.floored()
    const soil = toTill > 0
      ? blocksNear(bot, center, radius, SOIL, 1)
        .filter(b => OPEN.has(bot.blockAt(b.position.offset(0, 1, 0))?.name))
        .filter(b => !b.position.equals(feet.offset(0, -1, 0)))
        .sort((a, b) => Number(nearWater(bot, b.position)) - Number(nearWater(bot, a.position)))
      : []
    if (soil.length && !HOES.some(h => have(h))) {
      const hoe = await tryStep('hoe', () => obtainItem(ctx, { item: 'wooden_hoe' }))
      if (hoe && !hoe.ok) done.errors.push(`hoe: ${hoe.summary}`)
    }
    if (soil.length && HOES.some(h => have(h))) {
      for (const b of soil.slice(0, toTill)) {
        if (!time()) break
        await tryStep(`till ${b.position}`, async () => {
          await goNear(ctx, b.position, 3)
          const above = bot.blockAt(b.position.offset(0, 1, 0))
          if (above && above.name !== 'air') await bot.dig(above)
          await equipNamed(bot, HOES)
          await bot.activateBlock(bot.blockAt(b.position))
          if (await waitFor(ctx, () => bot.blockAt(b.position)?.name === 'farmland')) done.tilled++
        })
      }
    }
    for (const land of farmland()) {
      if (!time() || have('wheat_seeds') === 0) break
      await tryStep(`plant ${land.position}`, async () => {
        await goNear(ctx, land.position, 3)
        const above = land.position.offset(0, 1, 0)
        if (bot.blockAt(above)?.name !== 'air') await bot.dig(bot.blockAt(above))
        await equipNamed(bot, ['wheat_seeds'])
        await bot.activateBlock(bot.blockAt(land.position), new Vec3(0, 1, 0))
        if (await waitFor(ctx, () => bot.blockAt(above)?.name === 'wheat')) done.planted++
      })
    }
  }

  const crops = blocksNear(bot, center, radius, new Set(['wheat']), 2)
  const observations = {
    ...done,
    wheat: have('wheat'),
    seeds: have('wheat_seeds'),
    gained: { wheat: have('wheat') - (start.wheat ?? 0), wheat_seeds: have('wheat_seeds') - (start.wheat_seeds ?? 0) },
    crops: crops.length,
    ripe: crops.filter(c => ageOf(c) >= RIPE_AGE).length,
    breadReady: Math.floor(have('wheat') / 3),
    center: { x: center.x, y: center.y, z: center.z }
  }
  const summary = `Harvested ${done.harvested}, tilled ${done.tilled}, planted ${done.planted}; ${crops.length} crops growing, carrying ${observations.wheat} wheat and ${observations.seeds} seeds`
  if (done.harvested + done.tilled + done.planted > 0 || crops.length > 0) return ok(summary, observations)
  if (have('wheat_seeds') === 0) return fail(ErrorCategory.MISSING_MATERIALS, `${summary}. No seeds: break grass (none found within 32 blocks after ${done.grassBroken})`, observations)
  return fail(ErrorCategory.NOT_FOUND, `${summary}. No soil or farmland within ${radius} blocks of ${center}`, observations)
}
