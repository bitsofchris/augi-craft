import { selfDefense, visibleThreats, damageThreat } from '../tools/self-defense.js'
import { shelter, isNight, isCovered } from '../tools/shelter.js'
import { isBotName, humansOnline } from './crew.js'

/** Session-owned reflex: no parallel movement or actions outside run(). */

/** A non-bot player within `radius` blocks. */
export function playerNearby (bot, radius) {
  return Object.values(bot.players ?? {}).some(p => p.username !== bot.username && !isBotName(p.username) &&
    p.entity?.position && p.entity.position.distanceTo(bot.entity.position) <= radius)
}

export function installSelfDefense (session, bot) {
  let closed = false; let pending = null; let running = false; let scanTick = 0; let lastHealth = bot.health
  let retryAfter = 0
  const request = reason => {
    if (session.travelDefenseActive || closed || bot.health <= 0 || running || Date.now() < retryAfter) return
    pending = reason
    session.defenseState.pending = reason
    session.stop('self-defense priority')
    void drain()
  }
  const drain = async () => {
    if (running || !pending || closed) return
    running = true
    try {
      // The action's actual handler (including finally cleanup) must settle,
      // even if its public response already timed out. Never race pathfinders.
      const action = session.current
      if (action?.settled) await action.settled
      if (closed || !pending) return
      const args = pending; pending = null; session.defenseState.pending = null
      session.defenseState.active = true
      const result = await session.run('self_defense', ctx => selfDefense(ctx, args), { timeoutMs: 120_000 })
      session.defenseState.lastResult = result
      session.note('self_defense', { ok: result.ok, summary: result.summary })
      session.defenseState.paused = false
      retryAfter = Date.now() + (result.ok ? 5_000 : 15_000)
    } catch (err) {
      session.defenseState.lastResult = { ok: false, summary: err.message }
      session.defenseState.paused = false
      retryAfter = Date.now() + 15_000
    } finally {
      running = false; session.defenseState.active = false
    }
  }
  const hurt = (victim, source) => {
    if (victim !== bot.entity) return
    const attacker = damageThreat(bot, source)
    // Fall, hunger or drowning damage with no mob in sight must not stop work.
    if (!attacker && !visibleThreats(bot, 10).length) return
    request({ reason: attacker ? 'attacked by mob' : 'unattributed damage', attackerId: attacker?.id })
  }
  const health = () => {
    if (bot.health < lastHealth && visibleThreats(bot, 10).length) request({ reason: 'unattributed damage' })
    lastHealth = bot.health
  }
  // Night reflex: a bot that respawns at night, or idles outdoors at night with
  // a hostile in sight, digs in and seals itself underground. Off per worker
  // with policy nightShelter: false (AUGI_NIGHT_SHELTER=false; guards), and off
  // whenever a person is on the server: then bots keep working through the night.
  let sheltering = false; let shelterAfter = 0
  const nightShelter = session.defensePolicy?.nightShelter !== false
  const requestShelter = async why => {
    if (!nightShelter || closed || sheltering || running || session.current || Date.now() < shelterAfter || bot.health <= 0) return
    // Only a truly idle bot on an empty server digs in: not one whose job
    // resumes after a fight or death, and never while people are playing.
    if (session.resumePending > 0 || humansOnline(bot)) return
    if (!isNight(bot) || isCovered(bot)) return
    sheltering = true
    try {
      const result = await session.run('shelter', ctx => shelter(ctx), { timeoutMs: 30_000 })
      if (result.error?.category !== 'busy') session.note('sheltered', { ok: result.ok, summary: result.summary, why })
      shelterAfter = Date.now() + (result.ok ? 60_000 : 20_000)
    } catch {} finally { sheltering = false }
  }
  const respawned = () => { setTimeout(() => { void requestShelter('respawned at night') }, 1500) }
  const scan = () => {
    if (++scanTick % 10 !== 0 || running || closed) return
    if (scanTick % 40 === 0 && !session.current && isNight(bot) && visibleThreats(bot, 16).length) void requestShelter('idle outdoors at night with hostiles in sight')
    // Travel continues past distant mobs; working on ore defends sooner.
    const mining = ['dig_block', 'gather_blocks'].includes(session.current?.tool)
    const target = visibleThreats(bot, mining ? 10 : 3.5)[0]
    if (target) request({ reason: 'hostile nearby', attackerId: target.id })
  }
  const dispose = () => {
    closed = true; pending = null
    if (session.defenseState.active) session.stop('bot disconnected')
    bot.removeListener('entityHurt', hurt); bot.removeListener('health', health)
    bot.removeListener('physicsTick', scan); bot.removeListener('end', dispose); bot.removeListener('spawn', respawned)
  }
  bot.on('entityHurt', hurt); bot.on('health', health); bot.on('physicsTick', scan); bot.on('spawn', respawned); bot.once('end', dispose)
  return { dispose, cancelPending () { pending = null; session.defenseState.pending = null; retryAfter = Date.now() + 15_000 } }
}
