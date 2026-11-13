import pathfinderPkg from 'mineflayer-pathfinder'
import { livestock, protectedAnimal, huntAnimal } from './hunt.js'
import { ErrorCategory, fail, ok, inventoryCounts, diffCounts, roundPos } from './result.js'

const { goals } = pathfinderPkg

// Runs perception inside the movement loop, rather than between long MCP calls.
export async function huntArea (ctx, { animal = 'any', radius = 32, maxKills = 3, seconds = 60 } = {}) {
  const { bot } = ctx
  ctx.checkAbort()
  if (!Number.isInteger(radius) || radius < 8 || radius > 64 || !Number.isInteger(maxKills) || maxKills < 1 || maxKills > 8 || !Number.isInteger(seconds) || seconds < 5 || seconds > 90) return fail(ErrorCategory.INVALID_ARGUMENT, 'Invalid hunt radius, kill limit or duration')
  if (animal !== 'any' && !livestock.has(animal)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Choose any, sheep, cow, pig, chicken or rabbit')
  if (!bot.inventory.items().some(i => i.name.endsWith('_sword'))) return fail(ErrorCategory.MISSING_TOOL, 'Hunting requires a sword')
  const origin = bot.entity.position.clone()
  const before = inventoryCounts(bot)
  const deadline = Date.now() + seconds * 1000
  const original = bot.pathfinder.movements
  const walking = Object.assign(Object.create(Object.getPrototypeOf(original)), original, {
    canDig: false, allow1by1towers: false, scafoldingBlocks: []
  })
  const encounters = []; const attempted = new Set()
  let kills = 0; let waypoint = 0; let patrolTicks = 0; let scans = 0; let patrolGoal = null
  const report = () => ({ animal, kills, scans, waypoints: waypoint, encounters, position: roundPos(bot.entity.position),
    collected: Object.fromEntries(Object.entries(diffCounts(before, inventoryCounts(bot))).filter(([, n]) => n > 0)) })
  try {
    bot.pathfinder.setMovements(walking)
    // Inspect loaded nearby animals each tick, including ones newly encountered en route.
    for (let tick = 0; tick < seconds * 20 && Date.now() < deadline && kills < maxKills; tick++) {
      ctx.checkAbort()
      // Hunting is how a hungry bot gets food: never stop for low health or food.
      if (bot.inventory.emptySlotCount() < 2) return fail(ErrorCategory.INVENTORY_FULL, 'Return to deliver hunting supplies', report())
      if (origin.distanceTo(bot.entity.position) > radius + 3) return fail(ErrorCategory.UNREACHABLE, 'Reached hunt boundary', report())
      scans++
      const target = Object.values(bot.entities).filter(e =>
        e.position && (animal === 'any' ? livestock.has(e.name) : e.name === animal) && e.isValid !== false && !attempted.has(e.id) &&
        !protectedAnimal(bot, e) && origin.distanceTo(e.position) <= radius &&
        bot.entity.position.distanceTo(e.position) <= 24
      ).sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0]
      if (target) {
        bot.pathfinder.setGoal(null)
        attempted.add(target.id)
        const result = await huntAnimal({ ...ctx, huntDeadline: deadline }, { entityId: target.id })
        encounters.push({ entityId: target.id, ...result })
        if (result.observations?.killVerified) kills++
        if (result.observations?.killVerified && !result.ok) return fail(ErrorCategory.PARTIAL, 'Kill confirmed but pickup incomplete; inspect remaining drops before continuing patrol', report())
        patrolTicks = 0
        if (Date.now() >= deadline) break
      }
      const reached = patrolGoal && Math.hypot(bot.entity.position.x - patrolGoal.x, bot.entity.position.z - patrolGoal.z) <= 2.5
      if (patrolTicks === 0 || patrolTicks >= 100 || reached) {
        // Horizontal goals let pathfinder follow actual terrain height. Short legs
        // keep patrol within loaded terrain; failed paths are abandoned on schedule.
        const angle = waypoint++ * Math.PI / 4
        const ring = Math.min(radius - 2, 8 + Math.floor((waypoint - 1) / 8) * 8)
        patrolGoal = new goals.GoalNearXZ(
          Math.floor(origin.x + Math.cos(angle) * ring),
          Math.floor(origin.z + Math.sin(angle) * ring), 2)
        bot.pathfinder.setGoal(patrolGoal)
        patrolTicks = 0
      }
      await bot.waitForTicks(1)
      patrolTicks++
    }
    const result = report()
    return kills ? ok(`Hunt finished: ${kills} confirmed kills; inventory gains reported`, result)
      : fail(ErrorCategory.NOT_FOUND, 'No confirmed kills during bounded hunt', result)
  } finally {
    bot.pathfinder.setGoal(null)
    bot.clearControlStates()
    bot.pathfinder.setMovements(original)
  }
}
