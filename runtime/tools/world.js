// Small world/registry helpers shared by the tools.
// Block aliasing follows mindcraft's collectBlock (MIT, see THIRD_PARTY_NOTICES.md).
import { ErrorCategory, ToolError } from './result.js'

const ORE_SHORTHANDS = ['coal', 'diamond', 'emerald', 'iron', 'gold', 'lapis_lazuli', 'redstone', 'copper']

/** Expand a user-facing block name into concrete block names known to the registry. */
export function resolveBlockNames (registry, name) {
  name = String(name).trim().toLowerCase().replace(/^minecraft:/, '')
  const all = Object.keys(registry.blocksByName)
  let names
  if (name === 'log' || name === 'logs' || name === 'wood') {
    names = all.filter(n => n.endsWith('_log') && !n.startsWith('stripped_'))
  } else if (name === 'leaves') {
    names = all.filter(n => n.endsWith('_leaves'))
  } else {
    names = [name]
    if (ORE_SHORTHANDS.includes(name)) names.push(`${name}_ore`)
    if (name.endsWith('_ore') || ORE_SHORTHANDS.includes(name)) names.push(`deepslate_${name.endsWith('_ore') ? name : name + '_ore'}`)
    if (name === 'dirt') names.push('grass_block')
    if (name === 'cobblestone') names.push('stone')
  }
  names = [...new Set(names)].filter(n => registry.blocksByName[n])
  if (names.length === 0) {
    throw new ToolError(ErrorCategory.INVALID_ARGUMENT, `Unknown block "${name}"`, { suggestions: suggestNames(all, name) })
  }
  return names
}

/** Look up an item by name or throw invalid_argument with suggestions. */
export function requireItem (registry, name) {
  const clean = String(name).trim().toLowerCase().replace(/^minecraft:/, '')
  const item = registry.itemsByName[clean]
  if (!item) {
    throw new ToolError(ErrorCategory.INVALID_ARGUMENT, `Unknown item "${clean}"`, { suggestions: suggestNames(Object.keys(registry.itemsByName), clean) })
  }
  return item
}

export function suggestNames (names, query, limit = 5) {
  const parts = query.split(/[_\s]+/).filter(Boolean)
  return names
    .map(n => ({ n, score: parts.filter(p => n.includes(p)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.n.length - b.n.length)
    .slice(0, limit)
    .map(x => x.n)
}

/** Item names a block drops when harvested (used to verify gathering). */
export function dropNames (registry, blockName) {
  const block = registry.blocksByName[blockName]
  const names = new Set()
  for (const d of block?.drops ?? []) {
    const id = typeof d === 'object' ? (d.drop?.id ?? d.id ?? d.drop) : d
    const item = registry.items[id]
    if (item && item.name !== 'air') names.add(item.name)
  }
  if (names.size === 0 && registry.itemsByName[blockName]) names.add(blockName)
  return [...names]
}

/** Nearest matching blocks, closest first. */
export function findBlocks (bot, names, { maxDistance = 32, count = 10, visibleOnly = false } = {}) {
  const ids = names.map(n => bot.registry.blocksByName[n]?.id).filter(id => id !== undefined)
  // Mineflayer knows every block in a loaded chunk. Ore searches must not
  // reveal blocks hidden behind stone, so inspect more candidates and keep
  // only those the bot can actually see.
  const scanCount = visibleOnly ? Math.min(1024, Math.max(count * 32, count)) : count
  const positions = bot.findBlocks({ matching: ids, maxDistance, count: scanCount })
  const origin = bot.entity.position
  return positions
    .map(p => bot.blockAt(p))
    .filter(Boolean)
    .filter(b => !visibleOnly || bot.canSeeBlock(b))
    .sort((a, b) => origin.distanceTo(a.position) - origin.distanceTo(b.position))
    .slice(0, count)
}

export function isOreSearch (names) {
  return names.every(n => n.endsWith('_ore'))
}

export function describeBlock (bot, block) {
  return {
    name: block.name,
    position: { x: block.position.x, y: block.position.y, z: block.position.z },
    distance: Math.round(bot.entity.position.distanceTo(block.position) * 10) / 10
  }
}

export const EMPTY_BLOCKS = ['air', 'cave_air', 'void_air', 'water', 'lava', 'grass', 'short_grass', 'tall_grass', 'snow', 'dead_bush', 'fern', 'large_fern']

/** An air position with solid ground under it, near the bot but not where it stands. */
export function findFreeSpot (bot, { maxDistance = 4 } = {}) {
  const airIds = ['air', 'cave_air'].map(n => bot.registry.blocksByName[n]?.id).filter(id => id !== undefined)
  const feet = bot.entity.position.floored()
  const candidates = bot.findBlocks({ matching: airIds, maxDistance, count: 200 })
  for (const p of candidates) {
    const below = bot.blockAt(p.offset(0, -1, 0))
    if (!below || EMPTY_BLOCKS.includes(below.name) || below.boundingBox !== 'block') continue
    const dx = Math.abs(p.x - feet.x); const dz = Math.abs(p.z - feet.z); const dy = p.y - feet.y
    if (dx === 0 && dz === 0 && (dy === 0 || dy === 1)) continue // bot occupies it
    if (dy < -1 || dy > 1) continue
    if (dx + dz < 1) continue
    return p
  }
  return null
}
