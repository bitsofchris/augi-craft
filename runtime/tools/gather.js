// gather_blocks: collect N blocks of a type. Behavior adapted from mindcraft's
// collectBlock (MIT, see THIRD_PARTY_NOTICES.md); uses pathfinder movement,
// direct digging and verified inventory pickup.
import { ErrorCategory, fail, inventoryCounts, ok } from './result.js'
import { dropNames, findBlocks, isOreSearch, resolveBlockNames } from './world.js'
import { goNear } from './navigate.js'
import { Vec3 } from 'vec3'

const MAX_FAILURES = 3

/** Clear one reachable, visible block for stair headroom or construction. */
export async function digBlockAt (ctx, { x, y, z }) {
  const { bot } = ctx
  const position = new Vec3(x, y, z)
  const target = bot.blockAt(position)
  if (!target || ['air', 'cave_air', 'void_air', 'water', 'lava'].includes(target.name)) return fail(ErrorCategory.NOT_FOUND, 'No diggable block at the target')
  if (!bot.canSeeBlock(target)) return fail(ErrorCategory.UNREACHABLE, 'Target block is hidden; clear the obstruction first')
  if (bot.entity.position.offset(0, 1.6, 0).distanceTo(position.offset(0.5, 0.5, 0.5)) > 4.5) return fail(ErrorCategory.UNREACHABLE, 'Target block is outside digging reach')
  ctx.checkAbort()
  if (bot.inventory.items().length) await bot.tool.equipForBlock(target, {})
  if (!target.canHarvest(bot.heldItem?.type ?? null)) return fail(ErrorCategory.MISSING_TOOL, `Cannot harvest ${target.name} with current tools`)
  await bot.dig(target)
  await bot.waitForTicks(10)
  ctx.checkAbort()
  if (bot.blockAt(position)?.type === target.type) return fail(ErrorCategory.GAME_ERROR, 'Block did not change after digging')
  return ok(`Dug ${target.name} at ${position}`, { block: target.name, position: { x, y, z } })
}

export async function gatherBlocks (ctx, { block, count = 1, maxDistance = 64 }) {
  const { bot } = ctx
  if (!Number.isInteger(count) || count < 1) return fail(ErrorCategory.INVALID_ARGUMENT, 'count must be a positive integer')
  const names = resolveBlockNames(bot.registry, block)
  const drops = [...new Set(names.flatMap(n => dropNames(bot.registry, n)))]
  const start = inventoryCounts(bot)
  const gained = () => {
    const now = inventoryCounts(bot)
    return drops.reduce((sum, d) => sum + Math.max(0, (now[d] ?? 0) - (start[d] ?? 0)), 0)
  }

  const excluded = new Set()
  const errors = []
  let mined = 0
  while (gained() < count && mined < count * 3) {
    ctx.checkAbort()
    const target = findBlocks(bot, names, { maxDistance, count: 16, visibleOnly: isOreSearch(names) })
      .find(b => !excluded.has(b.position.toString()))
    if (!target) break

    // mineflayer-tool may call unequip('hand') even when both hand and
    // inventory are empty; there is nothing useful to equip in that case.
    if (bot.inventory.items().length > 0) await bot.tool.equipForBlock(target, {})
    if (!target.canHarvest(bot.heldItem?.type ?? null)) {
      const tools = Object.keys(target.harvestTools ?? {}).map(id => bot.registry.items[id]?.name).filter(Boolean)
      return fail(ErrorCategory.MISSING_TOOL, `Cannot harvest ${target.name} with current tools`, { requiresOneOf: tools, collected: gained() })
    }
    try {
      await goNear(ctx, target.position, 2)
      // Navigation may equip building blocks or another digging tool.
      if (bot.inventory.items().length > 0) await bot.tool.equipForBlock(target, {})
      if (!target.canHarvest(bot.heldItem?.type ?? null)) {
        return fail(ErrorCategory.MISSING_TOOL, `Cannot harvest ${target.name} after navigation`, { collected: gained() })
      }
      const beforeDig = gained()
      await bot.dig(target)
      await bot.waitForTicks?.(10)
      if (gained() === beforeDig) {
        // Drops can land just outside pickup range after the trunk is broken.
        await goNear(ctx, target.position, 1)
        await bot.waitForTicks?.(10)
      }
      mined++
    } catch (err) {
      ctx.checkAbort()
      if (/nochests|inventory/i.test(`${err.name} ${err.message}`)) {
        return fail(ErrorCategory.INVENTORY_FULL, 'Inventory full while gathering', { collected: gained() })
      }
      excluded.add(target.position.toString())
      errors.push(`${target.name} at ${target.position}: ${err.message}`)
      if (errors.length >= MAX_FAILURES) break
    }
  }

  const collected = gained()
  const now = inventoryCounts(bot)
  const items = Object.fromEntries(drops.map(d => [d, (now[d] ?? 0) - (start[d] ?? 0)]).filter(([, n]) => n > 0))
  const observations = { requested: count, collected, items, blocksMined: mined, errors }
  if (collected >= count) return ok(`Collected ${Object.entries(items).map(([k, v]) => `${v} ${k}`).join(', ')}`, observations)
  if (collected > 0) return fail(ErrorCategory.PARTIAL, `Collected only ${collected}/${count} ${block}`, observations)
  if (errors.length) return fail(ErrorCategory.UNREACHABLE, `Could not collect any ${block}`, observations)
  return fail(ErrorCategory.NOT_FOUND, `No ${block} within ${maxDistance} blocks`, observations)
}
