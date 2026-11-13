// shelter: survive the night by digging three blocks down and sealing the
// hole above the bot's head. Used by the night reflex (bot/self-defense.js)
// and callable from programs as lib.shelter. Mobs cannot reach or see the bot
// in a sealed hole; leave it in the morning with any navigate or program.
import { Vec3 } from 'vec3'
import { ErrorCategory, fail, ok, roundPos } from './result.js'

const LIQUID = new Set(['lava', 'water'])
const NO_DIG = new Set(['bedrock', 'chest', 'barrel', 'furnace', 'crafting_table', 'obsidian', 'spawner'])
// No sand or gravel: the seal sits right above the head, and falling blocks suffocate.
const FILL = ['dirt', 'cobblestone', 'cobbled_deepslate', 'stone', 'netherrack', 'andesite', 'diorite', 'granite', 'tuff', 'sandstone']
const AIRS = new Set(['air', 'cave_air', 'void_air'])

export function isNight (bot) {
  const t = bot.time?.timeOfDay ?? 0
  return t > 12_600 && t < 23_300
}

/** True when a solid block sits within three blocks above the bot's head. */
export function isCovered (bot) {
  const head = bot.entity.position.floored().offset(0, 1, 0)
  for (let dy = 1; dy <= 3; dy++) if (bot.blockAt(head.offset(0, dy, 0))?.boundingBox === 'block') return true
  return false
}

const nearLiquid = (bot, p) => [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
  .some(([x, y, z]) => LIQUID.has(bot.blockAt(p.offset(x, y, z))?.name))

export async function shelter (ctx, { depth = 3 } = {}) {
  const { bot } = ctx
  bot.pathfinder?.setGoal(null)
  bot.clearControlStates?.()
  if (isCovered(bot)) return ok('Already under cover', { position: roundPos(bot.entity.position), dug: 0, sealed: true })
  const top = bot.entity.position.floored()
  let dug = 0
  for (let d = 1; d <= depth; d++) {
    ctx.checkAbort()
    const p = top.offset(0, -d, 0)
    const b = bot.blockAt(p)
    if (!b || NO_DIG.has(b.name) || LIQUID.has(b.name) || nearLiquid(bot, p.offset(0, -1, 0)) || nearLiquid(bot, p)) break
    if (!AIRS.has(b.name)) {
      if (bot.inventory.items().length) await bot.tool?.equipForBlock?.(b, {})
      await bot.dig(b, true)
    }
    dug = d
  }
  if (dug < 2) return fail(ErrorCategory.UNREACHABLE, 'Cannot dig a shelter here (liquid, bedrock or protected block below)', { position: roundPos(top) })
  // Let the bot drop into the hole and pick up the dirt it dug.
  for (let i = 0; i < 20 && bot.entity.position.y > top.y - dug + 0.5; i++) await bot.waitForTicks(2)
  ctx.checkAbort()
  const cover = top.offset(0, -dug + 2, 0)
  let sealed = bot.blockAt(cover)?.boundingBox === 'block'
  const fill = FILL.map(n => bot.inventory.items().find(i => i.name === n)).find(Boolean) ?? bot.inventory.items().find(i => i.name.endsWith('_planks'))
  if (!sealed && fill) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const wall = bot.blockAt(cover.offset(dx, 0, dz))
      if (wall?.boundingBox !== 'block') continue
      await bot.equip(fill, 'hand')
      try { await bot.placeBlock(wall, new Vec3(-dx, 0, -dz)) } catch { continue }
      if (bot.blockAt(cover)?.boundingBox === 'block') { sealed = true; break }
    }
  }
  const observations = { position: roundPos(bot.entity.position), dug, sealed, cover: roundPos(cover) }
  if (!sealed) return fail(ErrorCategory.PARTIAL, fill ? 'Dug in but could not seal the hole' : 'Dug in but have no block to seal the hole', observations)
  return ok(`Sheltered ${dug} blocks underground; leave after dawn`, observations)
}
