import { ErrorCategory, fail, inventoryCounts, ok } from './result.js'

// Raw beef, pork, mutton, rabbit, fish and potatoes have no side effects; a
// starving bot may eat them. Raw chicken, rotten flesh and the like stay out.
export const SAFE_FOODS = new Set(['cooked_chicken', 'cooked_beef', 'cooked_porkchop', 'cooked_mutton', 'cooked_rabbit', 'cooked_cod', 'cooked_salmon', 'bread', 'baked_potato', 'carrot', 'apple', 'melon_slice', 'sweet_berries',
  'beef', 'porkchop', 'mutton', 'rabbit', 'cod', 'salmon', 'potato', 'dried_kelp'])

export async function eatFood (ctx, { item }) {
  const { bot } = ctx
  ctx.checkAbort()
  if (!SAFE_FOODS.has(item)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Choose ordinary safe food; raw chicken, rotten flesh, poisonous foods and potions are excluded')
  if (bot.food >= 20) return ok('Food already full; consumed nothing', { eaten: 0, food: bot.food })
  const food = bot.inventory.items().find(i => i.name === item)
  if (!food) return fail(ErrorCategory.MISSING_MATERIALS, `No ${item} to eat`)
  const prior = inventoryCounts(bot)[item] ?? 0
  const hunger = bot.food
  const previous = bot.heldItem
  let settled = false; let error = null
  try {
    await bot.equip(food, 'hand')
    ctx.checkAbort()
    bot.consume().then(() => { settled = true }, err => { error = err; settled = true })
    for (let tick = 0; tick < 120; tick++) {
      ctx.checkAbort()
      if ((inventoryCounts(bot)[item] ?? 0) === prior - 1 && bot.food > hunger) return ok(`Ate one ${item}`, { eaten: 1, foodBefore: hunger, food: bot.food, health: bot.health })
      if (settled && error) return fail(ErrorCategory.GAME_ERROR, `Eating failed: ${error.message}`)
      await bot.waitForTicks(1)
    }
    return fail(ErrorCategory.PARTIAL, 'Eating was not confirmed by both inventory and hunger; inspect before retrying', { foodBefore: hunger, food: bot.food, consumed: prior - (inventoryCounts(bot)[item] ?? 0) })
  } finally {
    bot.deactivateItem()
    if (previous && bot.inventory.items().some(i => i.type === previous.type)) await bot.equip(previous, 'hand')
    else await bot.unequip('hand')
  }
}
