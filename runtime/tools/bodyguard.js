import pathfinderPkg from 'mineflayer-pathfinder'
import { lookupPlayer } from './players.js'
import { hostiles, protectedAnimal } from './hunt.js'
import { shootBow } from './bow.js'
import { eatFood, SAFE_FOODS } from './food.js'
import { ErrorCategory, fail, ok, roundPos } from './result.js'

const { goals } = pathfinderPkg

export function followingPosition (player, distance) {
  const yaw = Number.isFinite(player.yaw) ? player.yaw : 0
  return player.position.offset(Math.sin(yaw) * distance, 0, Math.cos(yaw) * distance)
}

export async function guardPlayer (ctx, { username, seconds = 60, distance = 5, useBow = true }) {
  const { bot } = ctx
  let player = lookupPlayer(bot, username)?.entity
  if (!player || player.isValid === false) return fail(ErrorCategory.NOT_FOUND, 'Player must be online and within entity tracking range')
  if (player === bot.entity || player.id === bot.entity.id) return fail(ErrorCategory.INVALID_ARGUMENT, 'Cannot guard yourself')
  const weapons = ['netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'golden_sword', 'wooden_sword']
  const weapon = weapons.map(name => bot.inventory.items().find(i => i.name === name)).find(Boolean)
  if (!weapon) return fail(ErrorCategory.MISSING_TOOL, 'Prepare a sword before guarding; check base supply chests then craft one')
  const original = bot.pathfinder.movements
  const walking = Object.assign(Object.create(Object.getPrototypeOf(original)), original, {
    canDig: false, allow1by1towers: false, scafoldingBlocks: [], allowParkour: false
  })
  // Prefer paths that do not cross the player's personal space.
  walking.exclusionAreasStep = [...(original.exclusionAreasStep ?? []), block =>
    player && block.position?.distanceTo(player.position) < 2 ? 100 : 0]
  const threats = new Map(); const ignored = new Map()
  let hits = 0; let shots = 0; let deaths = 0; let supported = 0; let threatId = null
  let lastAttack = -20; let lastGoal = null; let anchor = bot.entity.position.clone(); let stalled = 0
  const eligible = e => e && bot.entities[e.id] === e && e.isValid !== false && !protectedAnimal(bot, e, hostiles)
  const hurt = (victim, source) => {
    if (!victim || !source) return
    if ((victim === player || victim === bot.entity) && eligible(source)) threats.set(source.id, { entity: source, until: Date.now() + 20_000, reason: 'defend' })
    if (source === player && eligible(victim)) threats.set(victim.id, { entity: victim, until: Date.now() + 20_000, reason: 'assist' })
  }
  const died = e => { if (threats.delete(e.id)) deaths++ }
  const report = () => ({ username, distance, meleeAttacks: hits, arrowsFired: shots, confirmedThreatDeaths: deaths,
    supportedEncounters: supported, position: roundPos(bot.entity.position), playerPosition: roundPos(player?.position) })
  bot.on('entityHurt', hurt); bot.on('entityDead', died)
  try {
    ctx.checkAbort()
    await bot.equip(weapon, 'hand')
    bot.pathfinder.setMovements(walking)
    const deadline = Date.now() + seconds * 1000
    let lastMeal = -1000
    for (let tick = 0; tick < seconds * 20 && Date.now() < deadline; tick++) {
      ctx.checkAbort()
      const current = lookupPlayer(bot, username)?.entity
      if (current !== player || player.isValid === false) return fail(ErrorCategory.PARTIAL, 'Player disconnected or left tracking range; stopped safely', report())
      // Hurt or hungry: eat if there is food, then keep guarding. A guard never
      // abandons its player for its own safety; dying and respawning is fine.
      if ((bot.food < 14 || (bot.health < 12 && bot.food < 20)) && tick - lastMeal > 100) {
        lastMeal = tick
        const food = bot.inventory.items().find(i => SAFE_FOODS.has(i.name) && i.name.startsWith('cooked_')) ?? bot.inventory.items().find(i => SAFE_FOODS.has(i.name))
        if (food) {
          await eatFood(ctx, { item: food.name })
          await bot.equip(weapon, 'hand')
        }
      }
      if (bot.entity.position.distanceTo(player.position) > 32) return fail(ErrorCategory.UNREACHABLE, 'Player exceeded safe following range', report())
      for (const [id, entry] of threats) {
        if (!eligible(entry.entity) || Date.now() > entry.until || entry.entity.position.distanceTo(player.position) > 8) threats.delete(id)
      }
      const entry = [...threats.values()].filter(e => (ignored.get(e.entity.id) ?? 0) <= Date.now())
        .sort((a, b) => a.entity.position.distanceTo(player.position) - b.entity.position.distanceTo(player.position))[0]
      if (entry) {
        const target = entry.entity
        if (threatId !== target.id) {
          supported++; threatId = target.id; stalled = 0; anchor = bot.entity.position.clone()
          bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)
        }
        const eye = bot.entity.position.offset(0, 1.62, 0)
        const aim = target.position.offset(0, (target.height ?? 1) / 2, 0)
        const reach = eye.distanceTo(aim)
        if (reach <= 3 && tick - lastAttack >= 20 && bot.world?.raycast && !bot.world.raycast(eye, aim.minus(eye).normalize(), reach)) {
          await bot.equip(weapon, 'hand')
          await bot.lookAt(aim, true)
          ctx.checkAbort()
          const nowEye = bot.entity.position.offset(0, 1.62, 0)
          const nowAim = target.position.offset(0, (target.height ?? 1) / 2, 0)
          if (eligible(target) && target.position.distanceTo(player.position) <= 8 && nowEye.distanceTo(nowAim) <= 3 &&
            !bot.world.raycast(nowEye, nowAim.minus(nowEye).normalize(), nowEye.distanceTo(nowAim))) {
            bot.attack(target); hits++; lastAttack = tick
          }
        } else if (useBow && reach >= 6 && reach <= 16 && target.position.distanceTo(player.position) >= 5 && tick % 40 === 0 && Date.now() + 4_000 < deadline) {
          // Current stationary aim only. Never fire into a close melee around the player.
          if (bot.inventory.items().some(i => i.name === 'bow') && bot.inventory.items().some(i => i.name === 'arrow')) {
            const result = await shootBow(ctx, { entityId: target.id })
            if (result.observations?.fired) shots++
            ctx.checkAbort()
            await bot.equip(weapon, 'hand')
            threatId = null
          }
        }
        if (reach > 3 && bot.entity.position.distanceTo(anchor) < .4) stalled++
        else { stalled = 0; anchor = bot.entity.position.clone() }
        if (stalled >= 120) {
          ignored.set(target.id, Date.now() + 30_000); threatId = null
          bot.pathfinder.setGoal(null); bot.clearControlStates()
        }
      } else {
        if (threatId !== null) { threatId = null; lastGoal = null; bot.pathfinder.setGoal(null) }
        const behind = followingPosition(player, distance)
        if (bot.entity.position.distanceTo(behind) > 1.5) {
          if (!lastGoal || behind.distanceTo(lastGoal) > 1 || tick % 40 === 0) {
            bot.pathfinder.setGoal(new goals.GoalNear(Math.floor(behind.x), Math.floor(behind.y), Math.floor(behind.z), 1))
            lastGoal = behind.clone()
          }
          if (bot.entity.position.distanceTo(anchor) < .4) stalled++
          else { anchor = bot.entity.position.clone(); stalled = 0 }
          if (stalled >= 120) return fail(ErrorCategory.UNREACHABLE, 'No safe following path made progress; stopped without digging', report())
        } else {
          bot.pathfinder.setGoal(null); bot.clearControlStates(); lastGoal = null; stalled = 0
        }
      }
      await bot.waitForTicks(1)
    }
    return ok('Bounded bodyguard interval completed', report())
  } finally {
    bot.pathfinder.setGoal(null); bot.clearControlStates(); bot.pathfinder.setMovements(original)
    bot.removeListener('entityHurt', hurt); bot.removeListener('entityDead', died)
  }
}
