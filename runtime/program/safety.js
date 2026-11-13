// Guards for the bot object that programs see. These enforce the play rules
// that matter most and are easy to break by accident: no chat commands (bots
// may have operator rights), no attacking players, pets, or named mobs.
//
// This is a guard against mistakes, not a security boundary. Programs run in a
// node:vm context, which does not isolate determined code from the host.
import { protectedAnimal } from '../tools/hunt.js'

const PROTECTED_NAMES = new Set(['wolf', 'cat', 'parrot', 'horse', 'donkey', 'mule', 'llama', 'camel', 'villager', 'iron_golem', 'snow_golem', 'allay'])

/** Why an entity may not be attacked, or null if it may. */
export function attackRefusal (bot, entity) {
  if (!entity) return 'no target entity'
  if (entity.type === 'player' || entity.username) return 'players are never attacked'
  if (entity === bot.entity) return 'cannot attack self'
  if (PROTECTED_NAMES.has(entity.name)) return `${entity.name} is protected (pets, villagers, golems)`
  if (bot.registry && protectedAnimal(bot, entity, new Set([entity.name]))) return 'named mobs are protected'
  if (entity.customName) return 'named mobs are protected'
  return null
}

/** Refuse chat that would run a server command. */
export function chatRefusal (message) {
  return String(message ?? '').trim().startsWith('/') ? 'chat commands are not allowed' : null
}

// Plugins a program drives directly; their methods also stop working once the
// program is stopped, so orphaned code cannot fight the reflex for movement.
const NESTED = new Set(['pathfinder', 'tool', 'collectBlock'])

/** Wrap an object so its methods throw once `stop.stopped()` is true. */
function stoppable (target, stop) {
  return new Proxy(target, {
    get (t, prop) {
      const value = Reflect.get(t, prop, t)
      if (typeof value !== 'function') return value
      return function (...a) {
        if (stop.stopped()) throw stop.error()
        return value.apply(t, a)
      }
    },
    set (t, prop, value) { return Reflect.set(t, prop, value, t) }
  })
}

/**
 * @param {object} bot
 * @param {{ stopped: () => boolean, error: () => Error }} [stop] when given,
 *   every method call fails after the program is stopped
 */
// A background job reruns its whole program after a fight or a death, so a
// line it says at the start would be repeated on every rerun. Drop a chat line
// identical to one this bot sent in the last two minutes.
const REPEAT_MS = 120_000
const recentChat = new WeakMap()
export function isRepeatChat (bot, message, now = Date.now()) {
  const seen = recentChat.get(bot) ?? new Map()
  recentChat.set(bot, seen)
  for (const [text, at] of seen) if (now - at > REPEAT_MS) seen.delete(text)
  if (seen.has(message)) return true
  seen.set(message, now)
  return false
}

export function guardBot (bot, stop = null) {
  if (!bot || typeof bot !== 'object') return bot
  const guarded = {
    chat (message) {
      const why = chatRefusal(message)
      if (why) throw new Error(`bot.chat refused: ${why}`)
      if (isRepeatChat(bot, String(message))) return
      return bot.chat(message)
    },
    whisper () { throw new Error('bot.whisper refused: use bot.chat') },
    attack (entity, ...rest) {
      const why = attackRefusal(bot, entity)
      if (why) throw new Error(`bot.attack refused: ${why}`)
      return bot.attack(entity, ...rest)
    },
    useOn (entity, ...rest) {
      const why = entity?.type === 'player' ? 'players are never targeted' : null
      if (why) throw new Error(`bot.useOn refused: ${why}`)
      return bot.useOn(entity, ...rest)
    },
    quit () { throw new Error('bot.quit refused: the runtime owns the connection') },
    end () { throw new Error('bot.end refused: the runtime owns the connection') }
  }
  const nested = {}
  return new Proxy(bot, {
    get (target, prop) {
      if (stop?.stopped() && (Object.hasOwn(guarded, prop) || typeof target[prop] === 'function')) {
        return () => { throw stop.error() }
      }
      if (Object.hasOwn(guarded, prop)) return guarded[prop]
      const value = Reflect.get(target, prop, target)
      if (stop && NESTED.has(prop) && value && typeof value === 'object') return (nested[prop] ??= stoppable(value, stop))
      return value
    },
    set (target, prop, value) {
      // Replacing a guarded method would write through to the real bot, and a
      // wrapper that calls bot.attack would then recurse into itself.
      if (Object.hasOwn(guarded, prop)) throw new Error(`bot.${String(prop)} cannot be replaced; wrap your own function instead`)
      return Reflect.set(target, prop, value, target)
    }
  })
}
