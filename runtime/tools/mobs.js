import { hostiles, protectedAnimal } from './hunt.js'
import { ErrorCategory, fail, ok, roundPos } from './result.js'

// Read only tracked entities: no chunk/entity spawning or navigation.
export async function scanMobs (ctx, { mob = 'spider', radius = 48 } = {}) {
  ctx.checkAbort()
  if (!['spider', 'hostile'].includes(mob) || !Number.isInteger(radius) || radius < 1 || radius > 64) return fail(ErrorCategory.INVALID_ARGUMENT, 'Choose spider/hostile and radius1–64')
  const { bot } = ctx
  const allowed = mob === 'spider' ? new Set(['spider', 'cave_spider']) : hostiles
  const targets = Object.values(bot.entities ?? {})
    .filter(e => e.position && e.isValid !== false && !protectedAnimal(bot, e, allowed) && bot.entity.position.distanceTo(e.position) <= radius)
    .map(e => ({ entityId: e.id, name: e.name, position: roundPos(e.position), distance: Math.round(bot.entity.position.distanceTo(e.position) * 10) / 10 }))
    .sort((a, b) => a.distance - b.distance)
  return ok(`Tracked ${targets.length} ${mob} target(s); live difficulty ${bot.game?.difficulty ?? 'unknown'}`, {
    difficulty: bot.game?.difficulty ?? null, timeOfDay: bot.time?.timeOfDay ?? null,
    position: roundPos(bot.entity.position), radius, targets
  })
}
