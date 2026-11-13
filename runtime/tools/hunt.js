import pathfinderPkg from 'mineflayer-pathfinder'
import { ErrorCategory, fail, ok, inventoryCounts, diffCounts, roundPos } from './result.js'

const { goals } = pathfinderPkg
export const livestock = new Set(['sheep', 'cow', 'pig', 'chicken', 'rabbit'])
export const hostiles = new Set(['zombie', 'husk', 'drowned', 'skeleton', 'stray', 'bogged', 'spider', 'cave_spider', 'silverfish', 'endermite', 'slime', 'magma_cube', 'witch', 'pillager'])
const drops = /^(.*_wool|(?:cooked_)?(?:mutton|beef|porkchop|chicken|rabbit)|leather|feather|rabbit_hide|rabbit_foot)$/

export function protectedAnimal (bot, entity, allowed = livestock) {
  const index = bot.registry.entitiesByName?.[entity.name]?.metadataKeys?.indexOf('custom_name')
  return entity.username || entity.customName || (index >= 0 && entity.metadata?.[index] != null) || !allowed.has(entity.name)
}

// One selected target per call. Disappearance alone is never proof of death.
export async function huntAnimal (ctx, args) {
  return pursueTarget(ctx, args, livestock)
}

export async function attackMob (ctx, args) {
  return pursueTarget(ctx, { ...args, maxHits: args.maxHits ?? 20 }, hostiles)
}

async function pursueTarget (ctx, { entityId, maxHits = 20 }, allowed) {
  const { bot } = ctx
  ctx.checkAbort()
  const target = bot.entities[entityId]
  if (!target || target.isValid === false) return fail(ErrorCategory.NOT_FOUND, 'Animal is no longer loaded')
  if (protectedAnimal(bot, target, allowed)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Target must be an unnamed allowed mob; players and pets are excluded')
  if (!Number.isInteger(maxHits) || maxHits < 1 || maxHits > 20) return fail(ErrorCategory.INVALID_ARGUMENT, 'maxHits must be 1 to 20')
  if (bot.inventory.emptySlotCount() < 2) return fail(ErrorCategory.INVENTORY_FULL, 'Need two free slots for animal drops')
  const origin = bot.entity.position.clone()
  if (origin.distanceTo(target.position) > 32) return fail(ErrorCategory.UNREACHABLE, 'Animal must start within 32 blocks')
  const weapon = bot.inventory.items().find(i => /_sword$/.test(i.name))
  if (!weapon) return fail(ErrorCategory.MISSING_TOOL, 'Hunting requires a sword')
  const original = bot.pathfinder.movements
  const walking = Object.assign(Object.create(Object.getPrototypeOf(original)), original)
  walking.canDig = false
  walking.allow1by1towers = false
  walking.scafoldingBlocks = []
  const before = inventoryCounts(bot)
  const acceptedDrop = name => allowed === livestock ? drops.test(name) : Boolean(bot.registry.itemsByName[name])
  let dead = false; let attacks = 0; let damageEvents = 0; let deathPosition; let lastAttack = -20
  let lastProgress = bot.entity.position.clone(); let stalledTicks = 0
  const spawned = new Map()
  const died = entity => {
    if (entity === target) { dead = true; deathPosition = entity.position.clone() }
  }
  const appeared = entity => { if (entity.name === 'item') spawned.set(entity.id, entity) }
  const hurt = entity => { if (entity === target) damageEvents++ }
  const observations = () => ({ entityId, animal: target.name, attacks, damageEvents, killVerified: dead,
    deathPosition: roundPos(deathPosition), collected: Object.fromEntries(Object.entries(diffCounts(before, inventoryCounts(bot))).filter(([name, n]) => n > 0 && acceptedDrop(name))) })
  bot.on('entityDead', died)
  bot.on('entitySpawn', appeared)
  bot.on('entityHurt', hurt)
  try {
    ctx.checkAbort()
    await bot.equip(weapon, 'hand')
    ctx.checkAbort()
    bot.pathfinder.setMovements(walking)
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true)
    const combatDeadline = Math.min(Date.now() + 30_000, (ctx.huntDeadline ?? Infinity) - 2_000)
    for (let tick = 0; tick < 600 && Date.now() < combatDeadline; tick++) {
      ctx.checkAbort()
      if (dead) break
      if (bot.entities[entityId] !== target || target.isValid === false) return fail(ErrorCategory.PARTIAL, 'Target disappeared without confirmed death', observations())
      if (protectedAnimal(bot, target, allowed)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Target identity changed; stopped hunt', observations())
      if (origin.distanceTo(target.position) > 32 || origin.distanceTo(bot.entity.position) > 32) return fail(ErrorCategory.UNREACHABLE, 'Target exceeded bounded pursuit radius', observations())
      if (attacks >= maxHits && tick - lastAttack >= 20) break
      const eye = bot.entity.position.offset(0, bot.entity.height ?? 1.62, 0)
      const aim = target.position.offset(0, (target.height ?? 1) / 2, 0)
      const distance = eye.distanceTo(aim)
      if (bot.entity.position.distanceTo(lastProgress) > 0.4 || distance <= 3) {
        lastProgress = bot.entity.position.clone(); stalledTicks = 0
      } else if (++stalledTicks >= 120) return fail(ErrorCategory.UNREACHABLE, 'Pursuit made no movement progress for six seconds', observations())
      if (attacks < maxHits && tick - lastAttack >= 20 && distance <= 3 && bot.world?.raycast &&
        !bot.world.raycast(eye, aim.minus(eye).normalize(), distance)) {
        await bot.lookAt(aim, true)
        ctx.checkAbort()
        // The target can move while turning; recheck before the side effect.
        const currentAim = target.position.offset(0, (target.height ?? 1) / 2, 0)
        const currentEye = bot.entity.position.offset(0, bot.entity.height ?? 1.62, 0)
        const reach = currentEye.distanceTo(currentAim)
        if (bot.entities[entityId] === target && !protectedAnimal(bot, target, allowed) && reach <= 3 &&
          !bot.world.raycast(currentEye, currentAim.minus(currentEye).normalize(), reach)) {
          bot.attack(target)
          attacks++
          lastAttack = tick
        }
      }
      await bot.waitForTicks(1)
    }
    bot.pathfinder.setGoal(null)
    bot.clearControlStates()
    if (!dead) return fail(ErrorCategory.PARTIAL, 'Bounded hunt ended without confirmed death', observations())
    // Item metadata can arrive after entitySpawn, and loot can still be falling.
    // Rescan during pickup rather than snapshotting empty metadata once.
    const pickupDeadline = Math.min(Date.now() + 6_000, ctx.huntDeadline ?? Infinity)
    let lootSeen = 0; let lootGoal = null; let lootPosition = null
    for (let tick = 0; tick < 120 && Date.now() < pickupDeadline; tick++) {
      ctx.checkAbort()
      if (bot.inventory.emptySlotCount() === 0) break
      const loot = [...spawned.values()].filter(e => {
        const stack = e.getDroppedItem?.()
        return bot.entities[e.id] === e && stack && acceptedDrop(stack.name) && e.position.distanceTo(deathPosition) <= 6
      }).sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))
      lootSeen = Math.max(lootSeen, loot.length)
      const item = loot[0]
      if (item && (item.id !== lootGoal || item.position.distanceTo(lootPosition) > 0.5)) {
        bot.pathfinder.setGoal(new goals.GoalNear(item.position.x, item.position.y, item.position.z, 0))
        lootGoal = item.id; lootPosition = item.position.clone()
      }
      if (!item && tick >= 20 && Object.keys(observations().collected).length) break
      await bot.waitForTicks(1)
    }
    ctx.checkAbort()
    const result = observations()
    result.lootSeen = lootSeen
    result.remainingDrops = [...spawned.values()].filter(e => bot.entities[e.id] === e && acceptedDrop(e.getDroppedItem?.()?.name ?? '') && e.position.distanceTo(deathPosition) <= 6).length
    result.collectionVerified = Object.keys(result.collected).length > 0
    if (!result.collectionVerified || result.remainingDrops) return fail(ErrorCategory.PARTIAL, 'Kill confirmed but drop pickup is incomplete or unconfirmed', result)
    return ok(`Confirmed ${target.name} death; collected drops reported from inventory`, result)
  } finally {
    bot.pathfinder.setGoal(null)
    bot.clearControlStates()
    bot.pathfinder.setMovements(original)
    bot.removeListener('entityDead', died)
    bot.removeListener('entitySpawn', appeared)
    bot.removeListener('entityHurt', hurt)
  }
}
