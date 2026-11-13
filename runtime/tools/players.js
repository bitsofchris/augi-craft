import { ErrorCategory, fail, inventoryCounts, ok, roundPos } from './result.js'
import { goNear, gotoWithProgress } from './navigate.js'
import pathfinderPkg from 'mineflayer-pathfinder'

const { goals } = pathfinderPkg

export function lookupPlayer (bot, username) {
  return Object.values(bot.players ?? {}).find(p => p.username?.toLowerCase() === username.toLowerCase())
}

export async function findPlayer (ctx, { username }) {
  const player = lookupPlayer(ctx.bot, username)
  if (!player) return fail(ErrorCategory.NOT_FOUND, `Player ${username} is not online`, { online: Object.keys(ctx.bot.players ?? {}) })
  const entity = player.entity
  return ok(`Player ${player.username} is online${entity ? ' and visible' : ' but outside entity tracking range'}`, {
    username: player.username, visible: Boolean(entity), position: roundPos(entity?.position),
    distance: entity ? ctx.bot.entity.position.distanceTo(entity.position) : null,
    lastSeen: entity ? null : newestSighting(ctx, player.username)
  })
}

// A bot sees players only within entity tracking range (about 128 blocks on
// a home server), so search rings are spaced about that far apart.
const SEARCH_RINGS = [[0, 1], [96, 6], [192, 12]] // [radius, waypoints]

/** Waypoints to visit, nearest ring first, when looking for a player around `center`. */
export function searchWaypoints (center, rings = SEARCH_RINGS) {
  const points = []
  for (const [radius, count] of rings) {
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count
      points.push({ x: Math.round(center.x + radius * Math.cos(angle)), y: center.y, z: Math.round(center.z + radius * Math.sin(angle)) })
    }
  }
  return points
}

/** The newest sighting of a player: this bot's own or a teammate's, in this dimension. */
export function newestSighting (ctx, username) {
  const key = username.toLowerCase()
  const dimension = ctx.bot.game?.dimension
  return [ctx.session?.lastSeen?.[key], ctx.session?.sightings?.get(key)]
    .filter(s => s?.position && (!s.dimension || !dimension || s.dimension === dimension))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0] ?? null
}

/**
 * Look for a player who is out of sight: walk to waypoints around their newest
 * sighting (or world spawn) until they come into view. Progress is kept on the
 * session, so the next call continues the search instead of starting over;
 * `exhausted` is set once every waypoint has been visited.
 */
async function searchForPlayer (ctx, player, deadline) {
  const { bot } = ctx
  const visible = () => Boolean(lookupPlayer(bot, player.username)?.entity)
  const sighting = newestSighting(ctx, player.username)
  const center = sighting?.position ?? roundPos(bot.spawnPoint ?? bot.entity.position)
  const where = sighting ? `around where ${sighting.by && sighting.by !== bot.username ? sighting.by : 'I'} last saw them` : 'around spawn'
  const key = `${player.username.toLowerCase()}@${center.x},${center.z}`
  const state = ctx.session?.playerSearch?.key === key ? ctx.session.playerSearch : { key, next: 0 }
  if (ctx.session) ctx.session.playerSearch = state
  const points = searchWaypoints(center)
  // Stop walking the moment the player comes into tracking range.
  const spotted = e => {
    if (e?.type === 'player' && e.username?.toLowerCase() === player.username.toLowerCase()) bot.pathfinder.setGoal(null)
  }
  bot.on('entitySpawn', spotted)
  const visited = []
  try {
    while (!visible() && Date.now() < deadline && state.next < points.length) {
      ctx.checkAbort()
      const p = points[state.next++]
      try {
        await gotoWithProgress(ctx, new goals.GoalNearXZ(p.x, p.z, 8))
      } catch (err) {
        ctx.checkAbort() // an interrupted search ends; an unreachable waypoint is skipped
      } finally {
        bot.pathfinder.setGoal(null)
      }
      visited.push({ x: p.x, z: p.z })
    }
  } finally {
    bot.removeListener('entitySpawn', spotted)
  }
  if (visible()) return ok(`Found ${player.username} ${where}`, { sighting, visited })
  const exhausted = state.next >= points.length
  if (exhausted) state.next = 0
  return fail(ErrorCategory.NOT_FOUND, `Searched ${visited.length} spot(s) ${where} (${center.x}, ${center.z}) without seeing ${player.username}; ${exhausted ? 'searched everywhere nearby' : 'call again to keep searching'}`, { sighting, center, visited, exhausted, waypointsLeft: points.length - state.next })
}

/**
 * Walk to a player: follow them while visible; otherwise search around their
 * newest sighting by any worker (or world spawn) until they come into view.
 */
export async function goToPlayer (ctx, { username, range = 3, seconds = 90 }) {
  const { bot } = ctx
  const player = lookupPlayer(bot, username)
  if (!player) return fail(ErrorCategory.NOT_FOUND, `Player ${username} is not online`, { online: Object.keys(bot.players ?? {}) })
  const deadline = Date.now() + seconds * 1000
  const target = () => lookupPlayer(bot, username)?.entity
  const close = () => target() && bot.entity.position.distanceTo(target().position) <= range + 0.5
  if (!target()) {
    const search = await searchForPlayer(ctx, player, deadline)
    if (!search.ok) return search
  }
  bot.pathfinder.setGoal(new goals.GoalFollow(target(), range), true)
  try {
    while (Date.now() < deadline && !close()) {
      ctx.checkAbort()
      if (!target()) return fail(ErrorCategory.NOT_FOUND, `Lost sight of ${player.username}; call again to search`)
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  } finally {
    bot.pathfinder.setGoal(null)
  }
  if (!close()) return fail(ErrorCategory.TIMEOUT, `Could not reach ${player.username} in ${seconds}s`, { distance: Math.round(bot.entity.position.distanceTo(target().position)) })
  return ok(`Next to ${player.username}`, { position: roundPos(target().position) })
}

/**
 * Drop real inventory items toward a specific nearby player, verifying pickup.
 * Throws level at chest height from about two blocks; if the player does not
 * pick the stack up, re-collects it and tries once more from closer.
 */
export async function giveItems (ctx, { username, item, count }) {
  const { bot } = ctx
  let player = lookupPlayer(bot, username)
  if (!player?.entity) return fail(ErrorCategory.NOT_FOUND, `Player ${username} is not visible; approach them first`)
  const have = inventoryCounts(bot)[item] ?? 0
  if (!have) return fail(ErrorCategory.MISSING_MATERIALS, `No ${item} in inventory`)
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) return fail(ErrorCategory.INVALID_ARGUMENT, 'count must be a positive integer')
  const amount = Math.min(count ?? have, have)
  let received = 0
  let recipient = null
  let dropped = null
  const collected = (collector, entity) => {
    if (collector.id !== recipient) return
    const stack = entity.getDroppedItem?.()
    if (!stack || stack.name === item) received += stack?.count ?? amount
  }
  const spawned = entity => {
    if (entity.name === 'item' && entity.position.distanceTo(bot.entity.position) < 3) dropped = entity
  }
  bot.on('playerCollect', collected)
  bot.on('entitySpawn', spawned)
  try {
    for (let attempt = 0; attempt < 2 && received < amount; attempt++) {
      await goNear(ctx, player.entity.position, attempt === 0 ? 2 : 1)
      ctx.checkAbort()
      player = lookupPlayer(bot, username)
      if (!player?.entity || bot.entity.position.distanceTo(player.entity.position) > 3.5) {
        return fail(ErrorCategory.UNREACHABLE, `${username} moved out of handoff range`, { received })
      }
      recipient = player.entity.id
      const toss = amount - received
      if ((inventoryCounts(bot)[item] ?? 0) < toss) break
      await bot.lookAt(player.entity.position.offset(0, 1.2, 0), true)
      await bot.toss(bot.registry.itemsByName[item].id, null, toss)
      for (let t = 0; t < 4 && received < amount; t++) await bot.waitForTicks(20)
      ctx.checkAbort()
      if (received >= amount || attempt === 1) break
      // Not picked up: fetch the stack back and try again from closer.
      if (dropped?.isValid !== false && dropped?.position) {
        await goNear(ctx, dropped.position, 0)
        await bot.waitForTicks(20)
      }
    }
    const removed = have - (inventoryCounts(bot)[item] ?? 0)
    const observations = { username: player.username, item, requested: amount, removed, received, droppedAt: dropped?.isValid !== false ? roundPos(dropped?.position) : null }
    if (received >= amount) return ok(`${player.username} picked up ${amount} ${item}`, observations)
    return fail(ErrorCategory.PARTIAL, `Dropped ${removed} ${item}; verified ${received} picked up by ${player.username}${observations.droppedAt ? `; it is on the ground at ${observations.droppedAt.x} ${observations.droppedAt.y} ${observations.droppedAt.z}` : ''}`, observations)
  } finally {
    bot.removeListener('playerCollect', collected)
    bot.removeListener('entitySpawn', spawned)
  }
}
