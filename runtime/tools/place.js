// place_block: adapted from mindcraft's placeBlock (MIT, see THIRD_PARTY_NOTICES.md),
// without its cheat-mode / setblock paths.
import { Vec3 } from 'vec3'
import { ErrorCategory, ToolError, fail, ok } from './result.js'
import { goNear } from './navigate.js'
import { EMPTY_BLOCKS, findFreeSpot } from './world.js'

const FACES = [
  new Vec3(0, -1, 0), new Vec3(0, 0, -1), new Vec3(0, 0, 1),
  new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 1, 0)
]

/**
 * Place an inventory item as a block. Throws ToolError on failure so other
 * tools (crafting, smelting) can reuse it. Returns the placed block position.
 */
export async function placeItem (ctx, itemName, at = null) {
  const { bot } = ctx
  const item = bot.inventory.items().find(i => i.name === itemName)
  if (!item) throw new ToolError(ErrorCategory.MISSING_MATERIALS, `No ${itemName} in inventory to place`)

  const dest = at ? new Vec3(Math.floor(at.x), Math.floor(at.y), Math.floor(at.z)) : findFreeSpot(bot)
  if (!dest) throw new ToolError(ErrorCategory.NOT_FOUND, 'No free spot with solid ground nearby to place on')

  const existing = bot.blockAt(dest)
  if (existing && !EMPTY_BLOCKS.includes(existing.name)) {
    throw new ToolError(ErrorCategory.INVALID_ARGUMENT, `${existing.name} already occupies ${dest}`)
  }
  let reference = null; let face = null
  for (const d of FACES) {
    const neighbor = bot.blockAt(dest.plus(d))
    if (neighbor && !EMPTY_BLOCKS.includes(neighbor.name)) {
      reference = neighbor
      face = new Vec3(-d.x, -d.y, -d.z)
      break
    }
  }
  if (!reference) throw new ToolError(ErrorCategory.INVALID_ARGUMENT, `Nothing adjacent to ${dest} to place against`)

  if (bot.entity.position.distanceTo(dest) > 4.5) await goNear(ctx, dest, 3)
  ctx.checkAbort()
  await bot.equip(item, 'hand')
  await bot.lookAt(reference.position.offset(0.5, 0.5, 0.5))
  const wasSneaking = bot.getControlState?.('sneak') ?? false
  try {
    // Right-clicking a crafting table, furnace or chest opens it unless
    // sneaking. Use the same placement gesture for every reference block.
    if (!wasSneaking) {
      bot.setControlState?.('sneak', true)
      await bot.waitForTicks?.(2)
    }
    await bot.placeBlock(reference, face)
  } catch (err) {
    // mineflayer can time out waiting for the block update even when the
    // placement succeeded, so verify against the world instead.
    if (bot.blockAt(dest)?.name !== itemName) throw new ToolError(ErrorCategory.GAME_ERROR, `Failed to place ${itemName} at ${dest}: ${err.message}`)
  } finally {
    if (!wasSneaking) bot.setControlState?.('sneak', false)
  }
  const placed = bot.blockAt(dest)
  if (!placed || EMPTY_BLOCKS.includes(placed.name)) throw new ToolError(ErrorCategory.GAME_ERROR, `Placement of ${itemName} at ${dest} not observed`)
  return placed
}

export async function placeBlock (ctx, { item, x, y, z }) {
  const at = [x, y, z].every(Number.isFinite) ? { x, y, z } : null
  if (!at && [x, y, z].some(v => v !== undefined)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Provide all of x, y, z or none')
  const placed = await placeItem(ctx, item, at)
  return ok(`Placed ${placed.name} at ${placed.position}`, { block: placed.name, position: { x: placed.position.x, y: placed.position.y, z: placed.position.z } })
}
