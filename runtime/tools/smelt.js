// smelt_item: adapted from mindcraft's smeltItem (MIT, see THIRD_PARTY_NOTICES.md).
import { ErrorCategory, fail, inventoryCounts, ok } from './result.js'
import { goNear } from './navigate.js'
import { placeItem } from './place.js'
import { describeBlock, findBlocks } from './world.js'

const FURNACE_RANGE = 16

/** Common furnace inputs and their outputs (used for validation and verification). */
export const SMELT_OUTPUTS = {
  raw_iron: 'iron_ingot', iron_ore: 'iron_ingot', deepslate_iron_ore: 'iron_ingot',
  raw_gold: 'gold_ingot', gold_ore: 'gold_ingot', raw_copper: 'copper_ingot', copper_ore: 'copper_ingot',
  cobblestone: 'stone', stone: 'smooth_stone', sand: 'glass', red_sand: 'glass', clay_ball: 'brick',
  netherrack: 'nether_brick', cactus: 'green_dye', kelp: 'dried_kelp', wet_sponge: 'sponge',
  beef: 'cooked_beef', porkchop: 'cooked_porkchop', chicken: 'cooked_chicken', mutton: 'cooked_mutton',
  rabbit: 'cooked_rabbit', cod: 'cooked_cod', salmon: 'cooked_salmon', potato: 'baked_potato'
}

/** Items smelted per fuel item. */
export function fuelValue (name) {
  if (name === 'coal' || name === 'charcoal') return 8
  if (name === 'coal_block') return 80
  if (name.endsWith('_planks') || name.endsWith('_log') || name.endsWith('_wood')) return 1.5
  if (name === 'stick') return 0.5
  return 0
}

export function smeltOutput (name) {
  if (SMELT_OUTPUTS[name]) return SMELT_OUTPUTS[name]
  if (name.endsWith('_log') || name.endsWith('_wood')) return 'charcoal'
  return null
}

/** Choose a fuel stack from inventory, preferring coal-type fuels. */
export function chooseFuel (inventory, exclude, needed) {
  const options = Object.entries(inventory)
    .filter(([name]) => name !== exclude && fuelValue(name) > 0)
    .map(([name, have]) => ({ name, have, value: fuelValue(name), required: Math.ceil(needed / fuelValue(name)) }))
    .sort((a, b) => b.value - a.value)
  return options.find(o => o.have >= o.required) ?? null
}

export async function smeltItem (ctx, { item, count = 1, fuel = null }) {
  const { bot } = ctx
  const output = smeltOutput(item)
  if (!output) return fail(ErrorCategory.INVALID_ARGUMENT, `Don't know how to smelt ${item}. Ores must be the raw item, e.g. raw_iron.`, { known: Object.keys(SMELT_OUTPUTS) })
  const inv = inventoryCounts(bot)
  if ((inv[item] ?? 0) < count) return fail(ErrorCategory.MISSING_MATERIALS, `Need ${count} ${item}, have ${inv[item] ?? 0}`, { missing: { [item]: count - (inv[item] ?? 0) } })

  let fuelChoice
  if (fuel) {
    const required = Math.ceil(count / (fuelValue(fuel) || 1))
    if ((inv[fuel] ?? 0) < required) return fail(ErrorCategory.MISSING_MATERIALS, `Need ${required} ${fuel} as fuel`, { missing: { [fuel]: required - (inv[fuel] ?? 0) } })
    fuelChoice = { name: fuel, required }
  } else {
    fuelChoice = chooseFuel(inv, item, count)
    if (!fuelChoice) return fail(ErrorCategory.MISSING_MATERIALS, `No fuel for ${count} ${item}; need coal, charcoal, planks or logs`, { missing: { coal: Math.ceil(count / 8) } })
  }

  const observations = {}
  let [furnaceBlock] = findBlocks(bot, ['furnace'], { maxDistance: FURNACE_RANGE, count: 1 })
  if (!furnaceBlock) {
    if (!inv.furnace) return fail(ErrorCategory.NO_STATION, `No furnace within ${FURNACE_RANGE} blocks and none in inventory`, { needs: 'furnace (8 cobblestone at a crafting table)' })
    furnaceBlock = await placeItem(ctx, 'furnace')
    observations.placedFurnace = describeBlock(bot, furnaceBlock)
  }
  await goNear(ctx, furnaceBlock.position, 3)
  await bot.lookAt(furnaceBlock.position)

  const furnace = await bot.openFurnace(furnaceBlock)
  const current = furnace.inputItem()
  if (current && current.name !== item) {
    furnace.close()
    return fail(ErrorCategory.BUSY, `Furnace is already smelting ${current.name}`, observations)
  }
  let total = 0
  try {
    if (!furnace.fuelItem()) await furnace.putFuel(bot.registry.itemsByName[fuelChoice.name].id, null, fuelChoice.required)
    await furnace.putInput(bot.registry.itemsByName[item].id, null, count)

    // ~10s per item in vanilla; give up after 12s without new output.
    let lastProgress = Date.now()
    while (total < count && Date.now() - lastProgress < 12_000) {
      ctx.checkAbort()
      await sleep(1000)
      if (furnace.outputItem()) {
        const taken = await furnace.takeOutput()
        if (taken) { total += taken.count; lastProgress = Date.now() }
      }
    }
  } finally {
    try { if (furnace.inputItem()) await furnace.takeInput() } catch {}
    try { if (furnace.fuelItem()) await furnace.takeFuel() } catch {}
    try { furnace.close() } catch {}
  }

  Object.assign(observations, { requested: count, smelted: total, output, fuel: fuelChoice.name })
  if (total >= count) return ok(`Smelted ${total} ${output}`, observations)
  if (total > 0) return fail(ErrorCategory.PARTIAL, `Smelted only ${total}/${count} ${output}`, observations)
  return fail(ErrorCategory.GAME_ERROR, `Furnace produced no ${output}`, observations)
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
