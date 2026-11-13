import pathfinderPkg from 'mineflayer-pathfinder'
import { hostiles, protectedAnimal } from './hunt.js'
import { ErrorCategory, fail, ok, roundPos } from './result.js'

const { goals } = pathfinderPkg
const dangerous = new Set(['creeper', 'ravager', 'vindicator', 'evoker', 'warden', 'wither', 'ender_dragon', 'ghast', 'blaze', 'hoglin', 'zoglin', 'piglin_brute', 'guardian', 'elder_guardian', 'phantom', 'breeze', 'wither_skeleton', 'shulker', 'vex', 'zombie_villager'])
const neutral = new Set(['enderman', 'piglin', 'zombified_piglin', 'polar_bear', 'bee'])
const allThreats = new Set([...hostiles, ...dangerous, ...neutral])
const swords = ['netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'golden_sword', 'wooden_sword']
export const defenseWeapon = bot => swords.map(name => bot.inventory.items().find(i => i.name === name)).find(Boolean)
const valid = (bot, e, allowed) => e && e !== bot.entity && bot.entities[e.id] === e && e.isValid !== false && !protectedAnimal(bot, e, allowed)
export function visibleThreats (bot, radius = 10) {
  const eye = bot.entity.position.offset(0, 1.62, 0)
  return Object.values(bot.entities ?? {}).filter(e => {
    if (!valid(bot, e, new Set([...hostiles, ...dangerous])) || e.position.distanceTo(bot.entity.position) > radius) return false
    const aim = e.position.offset(0, (e.height ?? 1) / 2, 0)
    const delta = aim.minus(eye); const reach = delta.norm()
    return reach > 0 && bot.world?.raycast && !bot.world.raycast(eye, delta.normalize(), reach)
  }).sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position))
}
export function damageThreat (bot, source) { return valid(bot, source, allThreats) ? source : null }

/** A spot about 5 blocks away from the nearest close creeper, or null. Exported for tests. */
export function creeperEscape (bot, radius = 4.5) {
  const creeper = Object.values(bot.entities ?? {}).filter(e => e?.name === 'creeper' && e.isValid !== false && e.position)
    .map(e => ({ e, d: e.position.distanceTo(bot.entity.position) })).filter(x => x.d < radius).sort((a, b) => a.d - b.d)[0]?.e
  if (!creeper) return null
  const away = bot.entity.position.minus(creeper.position); away.y = 0
  if (away.norm() === 0) away.x = 1
  return { creeper, point: bot.entity.position.plus(away.normalize().scaled(5)) }
}

// Policy: defend locally. Never route to base or operate refuge doors.
export async function selfDefense (ctx, { reason = 'hostile nearby', attackerId } = {}) {
  ctx.checkAbort()
  const { bot } = ctx
  const original = bot.pathfinder.movements
  const walking = Object.assign(Object.create(Object.getPrototypeOf(original)), original, {
    canDig: false, allow1by1towers: false, scafoldingBlocks: [], allowParkour: false, maxDropDown: 3
  })
  const origin = bot.entity.position.clone()
  const report = { reason, attacks: 0, damageEvents: 0, kills: 0, retreated: false, mode: 'local-defense', targets: [], died: false, position: roundPos(origin) }
  let target = damageThreat(bot, bot.entities[attackerId]) ?? visibleThreats(bot)[0]
  const dead = new Set(); let lastDeath = null
  const death = e => { if (e === target && !dead.has(e.id)) { dead.add(e.id); report.kills++; lastDeath = e.position.clone() } }
  const deadline = Date.now() + 30_000
  const died = () => { report.died = true }
  const hurt = e => { if (e === target) report.damageEvents++ }
  let movementKey = null
  const move = (key, goal, dynamic = false) => {
    if (key !== movementKey) { bot.pathfinder.setGoal(goal, dynamic); movementKey = key }
  }
  bot.on('death', died)
  bot.on('entityHurt', hurt)
  bot.on('entityDead', death)
  try {
    bot.pathfinder.setMovements(walking)
    const weapon = defenseWeapon(bot)
    if (weapon) { await bot.equip(weapon, 'hand'); ctx.checkAbort() }
    else await bot.unequip('hand')
    if (!target) return ok('No identified visible mob to defend against; stayed in place', report)
    let lastHit = -25
    for (let tick = 0; tick < 600 && Date.now() < deadline; tick++) {
      ctx.checkAbort()
      if (report.died || bot.health <= 0) return fail(ErrorCategory.PARTIAL, 'Defense stopped: bot died', report)
      if (bot.entity.position.distanceTo(origin) > 12) return fail(ErrorCategory.PARTIAL, 'Local defense boundary reached; no base retreat', report)
      // Creepers: never trade melee hits; keep out of the fuse radius instead.
      const escape = creeperEscape(bot)
      if (escape) {
        move(`flee:${escape.creeper.id}:${Math.round(escape.point.x)}:${Math.round(escape.point.z)}`, new goals.GoalNearXZ(escape.point.x, escape.point.z, 1))
        await bot.waitForTicks(1)
        continue
      }
      const nearest = visibleThreats(bot).find(e => !dead.has(e.id) && e.name !== 'creeper')
      if (target?.name === 'creeper') target = nearest
      if (dead.has(target?.id) || !valid(bot, target, allThreats) || (nearest && nearest !== target && nearest.position.distanceTo(bot.entity.position) < target.position.distanceTo(bot.entity.position) - 1)) target = nearest
      if (!target) {
        bot.pathfinder.setGoal(null)
        // Collect the local defeated mob's drops; never leave the defense area.
        if (lastDeath && lastDeath.distanceTo(origin) <= 8) {
          bot.pathfinder.setGoal(new goals.GoalNear(lastDeath.x, lastDeath.y, lastDeath.z, 1))
          for (let n = 0; n < 50; n++) { ctx.checkAbort(); if (report.died) return fail(ErrorCategory.PARTIAL, 'Defense stopped: bot died', report); if (visibleThreats(bot).length) break; await bot.waitForTicks(1) }
        }
        return ok('Local defense finished; no base travel', report)
      }
      if (!report.targets.includes(target.id)) report.targets.push(target.id)
      if (target.position.distanceTo(origin) > 8) return ok('Threat left local defense area; did not pursue or return to base', report)
      const eye = bot.entity.position.offset(0, 1.62, 0)
      const aim = target.position.offset(0, (target.height ?? 1) / 2, 0)
      const delta = aim.minus(eye); const reach = delta.norm()
      if (reach <= 3 && tick - lastHit >= 20 && !bot.world.raycast(eye, delta.normalize(), reach)) {
        await bot.lookAt(aim, true); ctx.checkAbort()
        const nowEye = bot.entity.position.offset(0, 1.62, 0)
        const nowDelta = target.position.offset(0, (target.height ?? 1) / 2, 0).minus(nowEye)
        if (valid(bot, target, allThreats) && nowDelta.norm() <= 3 && !bot.world.raycast(nowEye, nowDelta.normalize(), nowDelta.norm())) {
          bot.attack(target); report.attacks++; lastHit = tick
        }
      }
      if (target.name === 'creeper' && tick - lastHit < 15 && !dead.has(target.id)) {
        // A short local step after the hit avoids standing in the fuse radius.
        const away = bot.entity.position.minus(target.position); away.y = 0
        if (away.norm() > 0) {
          const point = bot.entity.position.plus(away.normalize().scaled(2))
          if (point.distanceTo(origin) <= 7) move(`space:${target.id}:${lastHit}`, new goals.GoalNearXZ(point.x, point.z, .5))
        }
      } else if (!dead.has(target.id)) move(`follow:${target.id}`, new goals.GoalFollow(target, 1), true)
      await bot.waitForTicks(1)
    }
    return fail(ErrorCategory.PARTIAL, 'Local defense limit reached; stayed nearby, no base retreat', report)
  } finally {
    report.position = roundPos(bot.entity.position)
    bot.pathfinder.setGoal(null); bot.clearControlStates(); bot.pathfinder.setMovements(original)
    bot.removeListener('entityDead', death); bot.removeListener('death', died); bot.removeListener('entityHurt', hurt)
  }
}

export async function resumeWork (ctx) {
  ctx.checkAbort()
  ctx.session.defenseState.paused = false
  ctx.session._defense?.cancelPending()
  return ok('Work resumed as requested; nearby mobs do not block commands')
}

// Owned by navigate_to's existing action: strike in reach without changing its
// destination, look direction or path goal. No separate movement controller.
export async function startTravelDefense (ctx) {
  const { bot, session } = ctx
  const report = { attacks: 0, damageEvents: 0, kills: 0, died: false }
  if (!session?.defensePolicy) return { report, stop () {} }
  ctx.checkAbort()
  const weapon = defenseWeapon(bot)
  if (weapon) await bot.equip(weapon, 'hand')
  else await bot.unequip('hand')
  ctx.checkAbort()
  let tick = 0; let lastHit = -20; let attacker = null
  const attacked = new Set(); const killed = new Set()
  const swing = () => {
    if (ctx.signal.aborted || report.died || bot.health <= 0) return
    tick++
    if (tick - lastHit < 20) return
    const target = visibleThreats(bot, 3)[0] ?? (valid(bot, attacker, allThreats) ? attacker : null)
    if (!target) return
    const eye = bot.entity.position.offset(0, 1.62, 0)
    const delta = target.position.offset(0, (target.height ?? 1) / 2, 0).minus(eye)
    const reach = delta.norm()
    if (reach <= 0 || reach > 3 || bot.world.raycast(eye, delta.normalize(), reach)) return
    attacked.add(target.id); bot.attack(target); report.attacks++; lastHit = tick
  }
  const hurt = (victim, source) => {
    if (victim === bot.entity) attacker = damageThreat(bot, source)
    else if (attacked.has(victim?.id)) report.damageEvents++
  }
  const dead = e => { if (attacked.has(e?.id) && !killed.has(e.id)) { killed.add(e.id); report.kills++ } }
  const death = () => { report.died = true; session.stop('death during travel') }
  session.travelDefenseActive = true
  bot.on('physicsTick', swing); bot.on('entityHurt', hurt); bot.on('entityDead', dead); bot.on('death', death)
  return { report, stop () {
    session.travelDefenseActive = false
    bot.removeListener('physicsTick', swing); bot.removeListener('entityHurt', hurt)
    bot.removeListener('entityDead', dead); bot.removeListener('death', death)
  } }
}
