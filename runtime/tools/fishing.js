import { Vec3 } from 'vec3'
import { ErrorCategory, fail, inventoryCounts, ok } from './result.js'

// One cast per call: inventory, rather than the reel animation, proves a catch.
export async function fishOnce (ctx, { x, y, z, seconds = 60 }) {
  const { bot } = ctx
  ctx.checkAbort()
  if (![x, y, z].every(Number.isInteger) || !Number.isFinite(seconds) || seconds < 1 || seconds > 75) return fail(ErrorCategory.INVALID_ARGUMENT, 'Supply a water block and 1–75 seconds')
  const water = bot.blockAt(new Vec3(x, y, z))
  if (water?.name !== 'water' || bot.blockAt(water.position.offset(0, 1, 0))?.name !== 'air') return fail(ErrorCategory.INVALID_ARGUMENT, 'Target must be open water with air above')
  const distance = bot.entity.position.distanceTo(water.position.offset(0.5, 0.8, 0.5))
  if (distance < 2 || distance > 7 || !bot.canSeeBlock(water)) return fail(ErrorCategory.UNREACHABLE, 'Stand on a safe bank 2–7 blocks from visible open water')
  const rod = bot.inventory.items().find(i => i.name === 'fishing_rod')
  if (!rod) return fail(ErrorCategory.MISSING_TOOL, 'Need a fishing rod (3 sticks and 2 string)')
  if (bot.inventory.emptySlotCount() < 1) return fail(ErrorCategory.INVENTORY_FULL, 'Leave an inventory slot free for catches')
  const previous = bot.heldItem
  const before = inventoryCounts(bot)
  let settled = false; let reelError = null
  try {
    await bot.equip(rod, 'hand')
    await bot.lookAt(water.position.offset(0.5, 0.8, 0.5))
    ctx.checkAbort()
    // Always attach rejection handling, including after a cancellation/timeout.
    bot.fish().then(() => { settled = true }, err => { reelError = err; settled = true })
    for (let tick = 0; tick < seconds * 20 && !settled; tick++) {
      ctx.checkAbort()
      await bot.waitForTicks(1)
    }
    ctx.checkAbort()
    if (!settled) return fail(ErrorCategory.TIMEOUT, 'No bite within this cast; retracting rod')
    if (reelError) return fail(ErrorCategory.GAME_ERROR, `Fishing failed: ${reelError.message}`)
    for (let tick = 0; tick < 100; tick++) {
      ctx.checkAbort()
      const after = inventoryCounts(bot)
      const caught = Object.fromEntries(Object.entries(after).filter(([name, n]) => name !== 'fishing_rod' && n > (before[name] ?? 0)).map(([name, n]) => [name, n - (before[name] ?? 0)]))
      if (Object.keys(caught).length) return ok('Reeled in and collected a catch', { caught, cookableFish: (caught.cod ?? 0) + (caught.salmon ?? 0) })
      await bot.waitForTicks(1)
    }
    return fail(ErrorCategory.PARTIAL, 'Reeled in, but no inventory pickup was confirmed')
  } finally {
    // Changing away from a rod retracts the bobber, including on stop_action.
    if (previous && previous.name !== 'fishing_rod' && bot.inventory.items().some(i => i.type === previous.type)) await bot.equip(previous, 'hand')
    else await bot.unequip('hand')
  }
}
