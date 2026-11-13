import { startTravelDefense } from './self-defense.js'
import pathfinderPkg from 'mineflayer-pathfinder'
import { Vec3 } from 'vec3'
import PathfinderPhysics from 'mineflayer-pathfinder/lib/physics.js'
import { ErrorCategory, ToolError, fail, ok, roundPos } from './result.js'
import { describeBlock, findBlocks, isOreSearch, resolveBlockNames } from './world.js'

const { goals } = pathfinderPkg

export async function inspectNavigation (ctx, { x, y, z }) {
  const { bot } = ctx
  const goal = new goals.GoalNear(x, y, z, 0)
  const result = bot.pathfinder.getPathTo(bot.pathfinder.movements, goal)
  const path = result.path ?? []
  const physics = new PathfinderPhysics(bot)
  const simulations = path.length ? [false, true].map(sprint => {
    const reached = physics.getReached(path)
    const state = physics.simulateUntil(reached, physics.getController(path[0], true, sprint), 20)
    return { sprint, reached: reached(state), position: roundPos(state.pos), onGround: state.onGround, jumpTicks: state.jumpTicks, velocity: roundPos(state.vel) }
  }) : []
  return ok('Inspected planned movement', { status: result.status, path: path.slice(0, 4), simulations, position: roundPos(bot.entity.position), onGround: bot.entity.onGround, jumpTicks: bot.jumpTicks, jumpQueued: bot.jumpQueued, controls: bot.controlState })
}

export async function stepTo (ctx, { x, y, z }) {
  const { bot } = ctx
  const target = new Vec3(x + 0.5, y, z + 0.5)
  const start = bot.entity.position.clone()
  if (Math.hypot(target.x - start.x, target.z - start.z) > 2 || Math.abs(target.y - start.y) > 1.1) return fail(ErrorCategory.INVALID_ARGUMENT, 'Step target must be adjacent and at most one block higher or lower')
  const floor = bot.blockAt(new Vec3(x, y - 1, z))
  if (floor?.boundingBox !== 'block' || [0, 1].some(dy => bot.blockAt(new Vec3(x, y + dy, z))?.boundingBox !== 'empty')) return fail(ErrorCategory.UNREACHABLE, 'Step requires solid footing and clear body space')
  bot.pathfinder.setGoal(null)
  bot.clearControlStates()
  const trace = []; const corrections = []
  const corrected = packet => { if (corrections.length < 5) corrections.push(packet) }
  bot._client.on('position', corrected)
  try {
    for (let tick = 0; tick < 25; tick++) {
      ctx.checkAbort()
      const p = bot.entity.position
      if (p.floored().equals(new Vec3(x, y, z)) && bot.entity.onGround) return ok('Completed adjacent step', { trace, corrections, position: roundPos(p) })
      await bot.look(Math.atan2(-(target.x - p.x), -(target.z - p.z)), 0, true)
      bot.setControlState('forward', Math.hypot(target.x - p.x, target.z - p.z) > 0.15)
      bot.setControlState('jump', y > start.y + 0.5 && tick < 15)
      await bot.waitForTicks(1)
      trace.push({ tick, position: { ...bot.entity.position }, onGround: bot.entity.onGround, velocity: { ...bot.entity.velocity }, jumpTicks: bot.jumpTicks })
    }
    return fail(ErrorCategory.UNREACHABLE, 'Adjacent step failed', { trace, corrections })
  } finally {
    bot.clearControlStates()
    bot._client.removeListener('position', corrected)
  }
}

/** Guard a third-party goto against missing completion events and stalled work. */
export async function gotoWithProgress (ctx, goal, { stallMs = 15_000, pollMs = 500 } = {}) {
  const { bot } = ctx
  let anchor = bot.entity.position.clone()
  let lastProgress = Date.now()
  let lastPath = null
  let lastReset = null
  let timer
  let arrived = false
  const progressed = () => { lastProgress = Date.now() }
  const pathUpdated = result => { lastPath = { status: result.status, nodes: result.path?.length ?? 0 } }
  const pathReset = reason => { lastReset = reason }
  bot.on('diggingCompleted', progressed)
  bot.on('blockPlaced', progressed)
  bot.on('path_update', pathUpdated)
  bot.on('path_reset', pathReset)
  try {
    await Promise.race([
      Promise.resolve().then(() => bot.pathfinder.goto(goal)),
      new Promise((resolve, reject) => {
        timer = setInterval(() => {
          try {
            ctx.checkAbort()
            const position = bot.entity.position
            if (bot.entity.onGround !== false && goal.isEnd(position.floored())) {
              arrived = true
              resolve()
              return
            }
            if (position.distanceTo(anchor) >= 0.5) {
              anchor = position.clone()
              progressed()
            }
            if (Date.now() - lastProgress >= stallMs) {
              reject(new ToolError(ErrorCategory.UNREACHABLE, `Navigation made no progress for ${stallMs}ms`, {
                stalled: true, position: roundPos(position), lastPath, lastReset,
                mining: bot.pathfinder.isMining?.() ?? false,
                building: bot.pathfinder.isBuilding?.() ?? false,
                onGround: bot.entity.onGround ?? null,
                supportBlock: bot.blockAt(position.floored().offset(0, -1, 0))?.name ?? null,
                digTarget: bot.targetDigBlock?.name ?? null,
                hand: bot.heldItem?.name ?? null
              }))
            }
          } catch (err) { reject(err) }
        }, pollMs)
      })
    ])
  } finally {
    clearInterval(timer)
    bot.removeListener('diggingCompleted', progressed)
    bot.removeListener('blockPlaced', progressed)
    bot.removeListener('path_update', pathUpdated)
    bot.removeListener('path_reset', pathReset)
    if (arrived) {
      bot.pathfinder.stop()
      bot.pathfinder.setGoal(null)
      bot.clearControlStates()
    }
  }
}

/** Path to within `range` blocks of a position. Throws ToolError(unreachable). */
export async function goNear (ctx, pos, range = 2) {
  const { bot } = ctx
  const target = new Vec3(pos.x, pos.y, pos.z)
  const goal = new goals.GoalNear(target.x, target.y, target.z, range)
  if (goal.isEnd(bot.entity.position.floored()) || bot.entity.position.distanceTo(target) <= range + 0.5) return
  ctx.checkAbort()
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await gotoWithProgress(ctx, goal)
      ctx.checkAbort()
      return
    } catch (err) {
      bot.pathfinder.stop()
      bot.pathfinder.setGoal(null)
      bot.clearControlStates()
      ctx.checkAbort()
      if (err.observations?.stalled && attempt === 0) continue
      throw new ToolError(ErrorCategory.UNREACHABLE, `Could not reach ${target}: ${err.message}`, { ...err.observations, replans: attempt })
    }
  }
}

/**
 * navigate_to: go to coordinates, the nearest block of a type, or a saved location.
 * args: { x, y, z } | { block, maxDistance } | { location }, plus optional range.
 */
export async function navigateTo (ctx, args) {
  const { bot } = ctx
  const range = args.range ?? 2
  let target; let label
  if (args.location) {
    const loc = ctx.locations?.get(args.location)
    if (!loc) return fail(ErrorCategory.NOT_FOUND, `No saved location "${args.location}"`, { known: ctx.locations?.list().map(l => l.name) ?? [] })
    target = loc.position
    label = `location "${loc.name}"`
  } else if (args.block) {
    const names = resolveBlockNames(bot.registry, args.block)
    const [block] = findBlocks(bot, names, { maxDistance: args.maxDistance ?? 64, count: 1, visibleOnly: isOreSearch(names) })
    if (!block) return fail(ErrorCategory.NOT_FOUND, `No ${args.block} within ${args.maxDistance ?? 64} blocks`)
    target = block.position
    label = `${block.name} at ${block.position}`
  } else if ([args.x, args.y, args.z].every(Number.isFinite)) {
    target = { x: args.x, y: args.y, z: args.z }
    label = `(${args.x}, ${args.y}, ${args.z})`
  } else {
    return fail(ErrorCategory.INVALID_ARGUMENT, 'Provide x/y/z, block, or location')
  }

  const originalMovements = bot.pathfinder.movements
  if (args.walkOnly) {
    const walking = Object.assign(Object.create(Object.getPrototypeOf(originalMovements)), originalMovements)
    walking.canDig = false
    walking.allow1by1towers = false
    walking.scafoldingBlocks = []
    bot.pathfinder.setMovements(walking)
  }
  let defense
  try {
    if (args.walkOnly) defense = await startTravelDefense(ctx)
    await goNear(ctx, target, range)
  } catch (err) {
    if (defense?.report.died) throw new ToolError(ErrorCategory.PARTIAL, 'Travel stopped: bot died', { combat: defense.report })
    err.observations = { ...err.observations, combat: defense?.report }
    throw err
  } finally {
    defense?.stop()
    if (args.walkOnly) bot.pathfinder.setMovements(originalMovements)
  }
  const distance = bot.entity.position.distanceTo(new Vec3(target.x, target.y, target.z))
  if (distance > range + 1.5) {
    return fail(ErrorCategory.UNREACHABLE, `Stopped ${distance.toFixed(1)} blocks from ${label}`, { distance })
  }
  return ok(`Arrived near ${label}`, { target, distance: Math.round(distance * 10) / 10, position: roundPos(bot.entity.position), combat: defense?.report })
}

/** find_blocks: locate the nearest blocks of a type without moving. */
export async function findBlocksTool (ctx, { block, maxDistance = 32, count = 5 }) {
  const { bot } = ctx
  const names = resolveBlockNames(bot.registry, block)
  const found = findBlocks(bot, names, { maxDistance, count, visibleOnly: isOreSearch(names) })
  if (found.length === 0) return fail(ErrorCategory.NOT_FOUND, `No ${block} within ${maxDistance} blocks`, { searched: names })
  return ok(`Found ${found.length} ${block} block(s); nearest ${found[0].name} at ${found[0].position}`, { blocks: found.map(b => describeBlock(bot, b)) })
}
