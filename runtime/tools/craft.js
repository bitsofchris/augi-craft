// craft_item: adapted from mindcraft's craftRecipe (MIT, see THIRD_PARTY_NOTICES.md).
// Differences: never auto-crafts prerequisites, reports exactly which
// ingredients are missing, and leaves a placed crafting table in the world.
import { ErrorCategory, categorize, fail, inventoryCounts, ok } from './result.js'
import { goNear } from './navigate.js'
import { placeItem } from './place.js'
import { describeBlock, findBlocks, requireItem } from './world.js'
import { confirmedCraftOnce } from './confirmed-craft.js'

const TABLE_RANGE = 16

/** Ingredient needs of `crafts` uses of a prismarine-recipe, as {name: count}. */
export function recipeNeeds (registry, recipe, crafts = 1) {
  const needs = {}
  for (const d of recipe.delta ?? []) {
    if (d.count >= 0) continue
    const name = registry.items[d.id]?.name ?? String(d.id)
    needs[name] = (needs[name] ?? 0) + -d.count * crafts
  }
  return needs
}

/** Shortfall of `needs` against inventory counts. */
export function missingFor (needs, inventory) {
  const missing = {}
  for (const [name, n] of Object.entries(needs)) {
    const short = n - (inventory[name] ?? 0)
    if (short > 0) missing[name] = short
  }
  return missing
}

/** How many times a recipe can be used with the given inventory. */
export function maxCrafts (registry, recipe, inventory) {
  const needs = recipeNeeds(registry, recipe, 1)
  return Math.min(...Object.entries(needs).map(([name, n]) => Math.floor((inventory[name] ?? 0) / n)))
}

// minecraft-data includes charcoal with only its default log recipe. Expand the
// ordinary campfire fuel alternative for every supplied wood variant. The
// native crafting backend still requires the server to show the exact output.
export function campfireFuelVariants (registry, item, recipes) {
  if (item !== 'campfire') return recipes
  const coal = registry.itemsByName.coal.id
  const charcoal = registry.itemsByName.charcoal.id
  const substitute = ingredient => ingredient?.id === coal ? { ...ingredient, id: charcoal } : ingredient
  return [...recipes, ...recipes.filter(r => r.delta.some(d => d.id === coal && d.count < 0)).map(r => ({
    ...r,
    inShape: r.inShape?.map(row => row.map(substitute)),
    ingredients: r.ingredients?.map(substitute),
    delta: r.delta.map(substitute)
  }))]
}

export async function craftItem (ctx, { item, count = 1, preferTable = false }) {
  const { bot } = ctx
  const target = requireItem(bot.registry, item)
  if (!Number.isInteger(count) || count < 1) return fail(ErrorCategory.INVALID_ARGUMENT, 'count must be a positive integer')

  const all = campfireFuelVariants(bot.registry, target.name, bot.recipesAll(target.id, null, true) ?? [])
  if (!all || all.length === 0) return fail(ErrorCategory.NOT_FOUND, `${target.name} has no crafting recipe (it may need smelting or gathering)`)

  const inv = inventoryCounts(bot)
  const perCraft = all[0].result?.count ?? 1
  const wantCrafts = Math.ceil(count / perCraft)

  // Use the same observed counts for recipe selection and batch sizing.
  // A stale/plugin-specific recipesFor result must never turn into craft(..., 0).
  const availableRecipes = hasTable => all.filter(recipe =>
    (hasTable || !recipe.requiresTable) && maxCrafts(bot.registry, recipe, inventoryCounts(bot)) >= 1)
  let recipes = availableRecipes(false)
  let table = null
  const observations = {}
  if (preferTable && recipes?.length) {
    const [nearby] = findBlocks(bot, ['crafting_table'], { maxDistance: TABLE_RANGE, count: 1 })
    if (nearby) {
      await goNear(ctx, nearby.position, 3)
      const atTable = availableRecipes(true)
      if (atTable?.length) {
        table = nearby
        recipes = atTable
      }
    }
  }
  if (!recipes || recipes.length === 0) {
    const tableRecipes = availableRecipes(true)
    if (!tableRecipes || tableRecipes.length === 0) {
      // Report the recipe variant closest to being craftable.
      const best = all
        .map(r => { const needs = recipeNeeds(bot.registry, r, wantCrafts); return { needs, missing: missingFor(needs, inv) } })
        .sort((a, b) => Object.values(a.missing).reduce((s, n) => s + n, 0) - Object.values(b.missing).reduce((s, n) => s + n, 0))[0]
      return fail(ErrorCategory.MISSING_MATERIALS, `Missing ingredients for ${count} ${target.name}: ${fmt(best.missing)}`, {
        requires: best.needs, missing: best.missing, requiresTable: all.every(r => r.requiresTable)
      })
    }
    ;[table] = findBlocks(bot, ['crafting_table'], { maxDistance: TABLE_RANGE, count: 1 })
    if (!table) {
      if (!inv.crafting_table) {
        return fail(ErrorCategory.NO_STATION, `${target.name} needs a crafting table; none within ${TABLE_RANGE} blocks and none in inventory`, { requiresTable: true })
      }
      table = await placeItem(ctx, 'crafting_table')
      observations.placedCraftingTable = describeBlock(bot, table)
    }
    await goNear(ctx, table.position, 3)
    recipes = availableRecipes(true)
    if (!recipes || recipes.length === 0) return fail(ErrorCategory.MISSING_MATERIALS, `Recipe for ${target.name} unavailable at the crafting table`)
  }

  ctx.checkAbort()
  const recipe = recipes[0]
  const resultCount = recipe.result?.count ?? 1
  const crafts = Math.min(Math.ceil(count / resultCount), maxCrafts(bot.registry, recipe, inventoryCounts(bot)))
  Object.assign(observations, { recipeIngredients: recipeNeeds(bot.registry, recipe), crafts })
  if (!Number.isFinite(crafts) || crafts < 1) {
    return fail(ErrorCategory.MISSING_MATERIALS, `Ingredients changed before crafting ${target.name}`, observations)
  }
  const beforeInventory = inventoryCounts(bot)
  const before = beforeInventory[target.name] ?? 0
  let craftError = null
  let completedCrafts = 0
  // Mineflayer batches can continue clicking after server corrections have
  // invalidated their local inventory model. Verify each craft before spending
  // more ingredients; never automatically retry a possibly consumed recipe.
  for (let i = 0; i < crafts; i++) {
    ctx.checkAbort()
    const stepBefore = inventoryCounts(bot)[target.name] ?? 0
    try {
      if (bot.version === '26.3') await confirmedCraftOnce(ctx, recipe, table)
      else await bot.craft(recipe, 1, table ?? undefined)
      await bot.waitForTicks?.(2)
    } catch (err) {
      // Preserve interruption semantics, but retain inventory evidence for
      // ordinary crafting failures that previously escaped to BotSession.
      ctx.checkAbort()
      craftError = err
      break
    }
    const stepMade = (inventoryCounts(bot)[target.name] ?? 0) - stepBefore
    if (stepMade !== resultCount) {
      observations.unexpectedOutput = { expected: resultCount, observed: stepMade }
      break
    }
    completedCrafts++
  }
  const afterInventory = inventoryCounts(bot)
  const made = (afterInventory[target.name] ?? 0) - before
  const consumed = Object.fromEntries(Object.entries(beforeInventory)
    .map(([name, amount]) => [name, amount - (afterInventory[name] ?? 0)])
    .filter(([, amount]) => amount > 0))

  Object.assign(observations, { requested: count, crafted: made, completedCrafts, usedTable: Boolean(table), consumed, backend: bot.version === '26.3' ? 'server-confirmed' : 'mineflayer' })
  if (craftError) {
    observations.craftError = craftError.message
    return fail(made > 0 ? ErrorCategory.PARTIAL : categorize(craftError), `Crafting ${target.name} failed after producing ${made}: ${craftError.message}`, observations)
  }
  if (made <= 0) return fail(ErrorCategory.GAME_ERROR, `Crafting ${target.name} produced nothing`, observations)
  if (made < count) return fail(ErrorCategory.PARTIAL, `Crafted only ${made}/${count} ${target.name}`, observations)
  return ok(`Crafted ${made} ${target.name}`, observations)
}

function fmt (counts) {
  return Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing'
}
