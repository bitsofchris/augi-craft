import { Vec3 } from 'vec3'
import { ErrorCategory, fail, inventoryCounts, ok } from './result.js'

export const CAMPFIRE_OUTPUTS = { cod: 'cooked_cod', salmon: 'cooked_salmon', chicken: 'cooked_chicken', beef: 'cooked_beef', porkchop: 'cooked_porkchop', mutton: 'cooked_mutton', rabbit: 'cooked_rabbit', potato: 'baked_potato' }

// Load one bounded batch, then collect the ejected food without standing on fire.
export async function cookCampfire (ctx, { x, y, z, item, count = 1 }) {
  const { bot } = ctx
  ctx.checkAbort()
  const output = CAMPFIRE_OUTPUTS[item]
  if (!output || !Number.isInteger(count) || count < 1 || count > 4 || ![x, y, z].every(Number.isInteger)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Supply a campfire, supported raw food and count 1–4')
  const position = new Vec3(x, y, z)
  const read = () => bot.blockAt(position)
  const valid = b => b?.name === 'campfire' && b.getProperties().lit === true && b.getProperties().waterlogged !== true
  let block = read()
  if (!valid(block)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Need an observed lit, dry campfire')
  const distance = bot.entity.position.distanceTo(position.offset(0.5, 0, 0.5))
  if (distance < 0.8 || distance > 2.2 || !bot.canSeeBlock(block)) return fail(ErrorCategory.UNREACHABLE, 'Stand beside the visible campfire, 0.8–2.2 blocks away, for safe pickup')
  // The block entity is server data. Refuse unknown or occupied stations.
  const contents = block.blockEntity?.Items ?? block.blockEntity?.items
  if (!Array.isArray(contents)) return fail(ErrorCategory.GAME_ERROR, 'Campfire contents unavailable; cannot confirm free slots')
  if (contents.length) return fail(ErrorCategory.BUSY, 'Campfire already contains food; finish that batch first', { contents })
  const before = inventoryCounts(bot)
  if ((before[item] ?? 0) < count) return fail(ErrorCategory.MISSING_MATERIALS, `Need ${count} ${item}`)
  if (bot.inventory.emptySlotCount() < 1) return fail(ErrorCategory.INVENTORY_FULL, 'Leave a slot free for cooked food')
  const sneaking = bot.getControlState('sneak')
  let loaded = 0
  try {
    if (sneaking) bot.setControlState('sneak', false)
    for (; loaded < count;) {
      ctx.checkAbort()
      block = read()
      if (!valid(block)) return fail(ErrorCategory.GAME_ERROR, 'Campfire changed while loading', { loaded })
      const food = bot.inventory.items().find(i => i.name === item)
      if (!food) return fail(ErrorCategory.PARTIAL, 'Food disappeared while loading', { loaded })
      await bot.equip(food, 'hand')
      ctx.checkAbort()
      const prior = inventoryCounts(bot)[item] ?? 0
      await bot.activateBlock(block, new Vec3(0, 1, 0))
      let confirmed = false
      for (let tick = 0; tick < 40; tick++) {
        ctx.checkAbort()
        if ((inventoryCounts(bot)[item] ?? 0) === prior - 1) { confirmed = true; break }
        await bot.waitForTicks(1)
      }
      if (!confirmed) return fail(ErrorCategory.GAME_ERROR, 'Campfire did not confirm consuming one food; no repeated click', { loaded })
      loaded++
    }
    for (let tick = 0; tick < 900; tick++) {
      ctx.checkAbort()
      const cooked = (inventoryCounts(bot)[output] ?? 0) - (before[output] ?? 0)
      if (cooked >= count) return ok(`Cooked and collected ${cooked} ${output} on a campfire`, { loaded, cooked, output, position: { x, y, z } })
      if (!valid(read())) return fail(ErrorCategory.PARTIAL, 'Campfire went out or changed; food may remain at station', { loaded, cooked, output })
      if (bot.health < 10) return fail(ErrorCategory.PARTIAL, 'Low health; stop cooking and move to safety', { loaded, cooked, output })
      await bot.waitForTicks(1)
    }
    return fail(ErrorCategory.PARTIAL, 'Cooking/pickup not completed within 45 seconds; inspect campfire before retrying', { loaded, cooked: (inventoryCounts(bot)[output] ?? 0) - (before[output] ?? 0), output, contents: read()?.blockEntity })
  } finally {
    if (sneaking) bot.setControlState('sneak', true)
  }
}
