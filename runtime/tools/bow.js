import { Vec3 } from 'vec3'
import { hostiles, protectedAnimal } from './hunt.js'
import { ErrorCategory, fail, ok, inventoryCounts, roundPos } from './result.js'

// Full draw, discrete vanilla arrow trajectory: speed 3 blocks/tick,
// drag .99, gravity .05. Static targets only; live impact is verified separately.
export function bowTrajectory (eye, aim) {
  const delta = aim.minus(eye)
  const horizontal = Math.hypot(delta.x, delta.z)
  if (horizontal < 3 || horizontal > 24) return null
  const ux = delta.x / horizontal; const uz = delta.z / horizontal
  const trace = angle => {
    let p = eye.clone(); let v = new Vec3(ux * 3 * Math.cos(angle), 3 * Math.sin(angle), uz * 3 * Math.cos(angle))
    const points = [p.clone()]
    for (let tick = 0; tick < 30; tick++) {
      const next = p.plus(v)
      if (Math.hypot(next.x - eye.x, next.z - eye.z) >= horizontal) {
        const covered = Math.hypot(p.x - eye.x, p.z - eye.z)
        const fraction = (horizontal - covered) / Math.hypot(v.x, v.z)
        const end = p.plus(v.scaled(fraction))
        points.push(end)
        return { error: end.y - aim.y, points }
      }
      p = next; points.push(p.clone()); v = v.scaled(.99); v.y -= .05
    }
    return null
  }
  let low = -1; let high = 1
  if (!trace(low) || !trace(high) || trace(low).error > 0 || trace(high).error < 0) return null
  for (let i = 0; i < 35; i++) {
    const mid = (low + high) / 2
    if (trace(mid).error < 0) low = mid
    else high = mid
  }
  const angle = (low + high) / 2
  return { ...trace(angle), direction: new Vec3(ux * Math.cos(angle), Math.sin(angle), uz * Math.cos(angle)) }
}

function friendly (e) {
  return e.type === 'player' || e.username || ['wolf', 'cat', 'villager', 'iron_golem', 'snow_golem'].includes(e.name) || e.customName
}

export function safeArrowPath (bot, plan, targetBlock = null, targetId = null) {
  if (!bot.world?.raycast) return false
  for (let i = 1; i < plan.points.length; i++) {
    const start = plan.points[i - 1]; const delta = plan.points[i].minus(start)
    const obstruction = bot.world.raycast(start, delta.normalize(), delta.norm())
    if (obstruction && (!targetBlock || !obstruction.position?.equals(targetBlock))) return false
    const steps = Math.max(1, Math.ceil(delta.norm() * 4))
    for (let step = 0; step <= steps; step++) {
      const p = start.plus(delta.scaled(step / steps))
      for (const e of Object.values(bot.entities ?? {})) {
        if (e === bot.entity || e.id === targetId || !e.position || !friendly(e)) continue
        if (p.distanceTo(e.position.offset(0, (e.height ?? 1.8) / 2, 0)) < 1.5) return false
      }
    }
  }
  return true
}

export async function shootBow (ctx, { entityId, x, y, z }) {
  const { bot } = ctx
  ctx.checkAbort()
  const bow = bot.inventory.items().find(i => i.name === 'bow')
  if (!bow || !(inventoryCounts(bot).arrow > 0)) return fail(ErrorCategory.MISSING_TOOL, 'Need a bow and ordinary arrows in inventory')
  let entity; let targetBlock; let aim
  if (entityId !== undefined) {
    entity = bot.entities[entityId]
    if (!entity || entity.isValid === false) return fail(ErrorCategory.NOT_FOUND, 'Target mob is not loaded')
    if (protectedAnimal(bot, entity, hostiles)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Bow combat targets must be unnamed allowed hostile mobs; no players or pets')
    aim = entity.position.offset(0, (entity.height ?? 1) / 2, 0)
  } else if ([x, y, z].every(Number.isInteger)) {
    targetBlock = new Vec3(x, y, z)
    const block = bot.blockAt(targetBlock)
    const backstops = ['stone', 'cobblestone', 'deepslate', 'cobbled_deepslate', 'dirt', 'granite', 'diorite', 'andesite', 'stone_bricks']
    if (block?.boundingBox !== 'block' || !backstops.includes(block.name)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Practice requires an observed stone or dirt backstop')
    aim = targetBlock.offset(.5, .5, .5)
  } else return fail(ErrorCategory.INVALID_ARGUMENT, 'Provide entityId or all integer target block coordinates')
  const eye = () => bot.entity.position.offset(0, 1.62, 0)
  let plan = bowTrajectory(eye(), aim)
  if (!plan || !safeArrowPath(bot, plan, targetBlock, entityId)) return fail(ErrorCategory.UNREACHABLE, 'No clear friendly-free bow arc within 3–24 horizontal blocks')
  let hurt = false; let arrow = null; let impact = false; let drawing = false; let released = false
  const damaged = (e, source) => { if (e === entity && source === bot.entity) hurt = true }
  const spawned = e => {
    if (released && e.name === 'arrow' && e.position?.distanceTo(eye()) < 4) arrow = e
  }
  const before = inventoryCounts(bot).arrow
  bot.on('entityHurt', damaged); bot.on('entitySpawn', spawned)
  try {
    bot.pathfinder.setGoal(null); bot.clearControlStates()
    await bot.equip(bow, 'hand')
    await bot.lookAt(eye().plus(plan.direction.scaled(10)), true)
    ctx.checkAbort()
    bot.activateItem(); drawing = true
    for (let tick = 0; tick < 22; tick++) { ctx.checkAbort(); await bot.waitForTicks(1) }
    ctx.checkAbort()
    if (entity && (bot.entities[entityId] !== entity || entity.isValid === false || protectedAnimal(bot, entity, hostiles))) return fail(ErrorCategory.NOT_FOUND, 'Target changed while drawing')
    if (entity) aim = entity.position.offset(0, (entity.height ?? 1) / 2, 0)
    plan = bowTrajectory(eye(), aim)
    if (!plan || !safeArrowPath(bot, plan, targetBlock, entityId)) return fail(ErrorCategory.UNREACHABLE, 'Shot became unsafe while drawing; bow not released')
    await bot.lookAt(eye().plus(plan.direction.scaled(10)), true)
    ctx.checkAbort()
    // Final safety check after turning, before firing.
    if (!safeArrowPath(bot, plan, targetBlock, entityId)) return fail(ErrorCategory.UNREACHABLE, 'Friendly moved into the firing arc')
    released = true; bot.deactivateItem(); drawing = false
    for (let tick = 0; tick < 40; tick++) {
      ctx.checkAbort()
      if (targetBlock && arrow?.velocity?.norm() < .05 &&
        arrow.position.plus(plan.direction.scaled(.15)).floored().equals(targetBlock)) impact = true
      if (hurt || impact) break
      await bot.waitForTicks(1)
    }
    const used = before - (inventoryCounts(bot).arrow ?? 0)
    const observations = { arrowsUsed: used, fired: used === 1, hitConfirmed: hurt || impact, target: roundPos(aim), arrowPosition: roundPos(arrow?.position) }
    return used === 1 ? ok('Arrow fired; impact confirmation reported separately', observations)
      : fail(ErrorCategory.GAME_ERROR, 'Arrow consumption not confirmed', observations)
  } finally {
    // Unequip BEFORE releasing an interrupted draw so cancellation cannot shoot.
    try {
      if (drawing) {
        await bot.unequip('hand')
        bot.deactivateItem()
      }
    } finally {
      bot.removeListener('entityHurt', damaged); bot.removeListener('entitySpawn', spawned)
    }
  }
}
