import { ErrorCategory, fail, ok, inventoryCounts } from './result.js'

const livestock = new Set(['sheep', 'cow', 'pig', 'chicken', 'rabbit'])

// No chasing or terrain edits: callers first approach an observed entity.
function targetAnimal (bot, entityId, sheepOnly = false) {
  const entity = bot.entities[entityId]
  if (!entity || entity.isValid === false) return { error: fail(ErrorCategory.NOT_FOUND, 'Animal is no longer loaded') }
  if (entity.username || !livestock.has(entity.name) || (sheepOnly && entity.name !== 'sheep')) {
    return { error: fail(ErrorCategory.INVALID_ARGUMENT, sheepOnly ? 'Target must be a sheep' : 'Target must be sheep, cow, pig, chicken or rabbit; players and pets are excluded') }
  }
  const eye = bot.entity.position.offset(0, bot.entity.height ?? 1.62, 0)
  const aim = entity.position.offset(0, (entity.height ?? 1) / 2, 0)
  const distance = eye.distanceTo(aim)
  if (distance > 3) return { error: fail(ErrorCategory.UNREACHABLE, 'Animal must be within 3 blocks; approach safely first') }
  if (!bot.world?.raycast) return { error: fail(ErrorCategory.GAME_ERROR, 'Entity visibility check unavailable') }
  if (distance > 0 && bot.world.raycast(eye, aim.minus(eye).normalize(), distance)) {
    return { error: fail(ErrorCategory.UNREACHABLE, 'Animal is behind a block') }
  }
  return { entity, aim }
}

function sheepFlags (bot, entity) {
  const keys = bot.registry.entitiesByName?.sheep?.metadataKeys
  const index = keys?.indexOf('wool')
  return index >= 0 ? entity.metadata?.[index] : undefined
}

export async function shearSheep (ctx, { entityId }) {
  const { bot } = ctx
  let target = targetAnimal(bot, entityId, true)
  if (target.error) return target.error
  const shears = bot.inventory.items().find(item => item.name === 'shears')
  if (!shears) return fail(ErrorCategory.MISSING_TOOL, 'Shearing requires shears (craft from two iron ingots)')
  if (bot.inventory.emptySlotCount() === 0) return fail(ErrorCategory.INVENTORY_FULL, 'Make room for wool before shearing')
  const flags = sheepFlags(bot, target.entity)
  if (flags & 16) return fail(ErrorCategory.NOT_FOUND, 'Sheep is already sheared; let it regrow wool')
  const woolCount = () => Object.entries(inventoryCounts(bot)).reduce((sum, [name, count]) => sum + (name.endsWith('_wool') ? count : 0), 0)
  const before = woolCount()
  ctx.checkAbort()
  await bot.equip(shears, 'hand')
  target = targetAnimal(bot, entityId, true)
  if (target.error) return target.error
  ctx.checkAbort()
  await bot.activateEntity(target.entity)
  for (let tick = 0; tick < 20; tick++) {
    ctx.checkAbort()
    const current = bot.entities[entityId]
    const state = current && sheepFlags(bot, current)
    const collected = woolCount() - before
    if (collected > 0) return ok(`Collected ${collected} wool after shearing`, { entityId, collected })
    if (typeof state === 'number' && (state & 16)) {
      return ok('Sheep sheared; wool drops still need pickup and inventory verification', { entityId, sheared: true, collected: false })
    }
    await bot.waitForTicks(1)
  }
  return fail(ErrorCategory.TIMEOUT, 'Shearing not confirmed; inspect sheep and nearby wool drops before retrying', { entityId, metadataAvailable: typeof flags === 'number' })
}

export async function attackAnimal (ctx, { entityId }) {
  const { bot } = ctx
  let target = targetAnimal(bot, entityId)
  if (target.error) return target.error
  ctx.checkAbort()
  await bot.lookAt(target.aim)
  target = targetAnimal(bot, entityId)
  if (target.error) return target.error
  ctx.checkAbort()
  bot.attack(target.entity)
  // One hit only; respect cooldown before another bounded call.
  await bot.waitForTicks(20)
  ctx.checkAbort()
  return ok('Sent one animal attack; inspect target and inventory before continuing', { entityId, animal: target.entity.name, attacks: 1, killVerified: false })
}
