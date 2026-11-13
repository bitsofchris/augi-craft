import { ok, inventoryCounts, roundPos } from './result.js'
import { describeBlock, findBlocks, resolveBlockNames } from './world.js'

const NOTABLE = ['log', 'crafting_table', 'furnace', 'chest', 'coal_ore', 'iron_ore', 'copper_ore', 'gold_ore', 'diamond_ore', 'stone', 'water', 'lava']
const EQUIPMENT_SLOTS = { head: 5, torso: 6, legs: 7, feet: 8, 'off-hand': 45 }

/** observe: position, vitals, inventory, equipment, nearby blocks and entities. */
export async function observe (ctx, { radius = 8, notableRadius = 32 } = {}) {
  const { bot } = ctx
  const pos = bot.entity.position

  // Counts of every non-air block type in a small cube around the bot.
  const nearbyCounts = {}
  const solidIds = Object.values(bot.registry.blocksByName)
    .filter(b => !['air', 'cave_air', 'void_air'].includes(b.name)).map(b => b.id)
  for (const p of bot.findBlocks({ matching: solidIds, maxDistance: radius, count: 10_000 })) {
    const b = bot.blockAt(p)
    if (b && (!b.name.endsWith('_ore') || bot.canSeeBlock(b))) nearbyCounts[b.name] = (nearbyCounts[b.name] ?? 0) + 1
  }
  const nearbyBlocks = Object.fromEntries(Object.entries(nearbyCounts).sort((a, b) => b[1] - a[1]).slice(0, 25))

  // Nearest instance of each notable resource/station within a wider radius.
  const notable = {}
  for (const n of NOTABLE) {
    let names
    try { names = resolveBlockNames(bot.registry, n) } catch { continue }
    const [nearest] = findBlocks(bot, names, { maxDistance: notableRadius, count: 1, visibleOnly: n.endsWith('_ore') })
    if (nearest) notable[n] = describeBlock(bot, nearest)
  }

  const equipment = { hand: bot.heldItem?.name ?? null }
  for (const [slot, idx] of Object.entries(EQUIPMENT_SLOTS)) equipment[slot] = bot.inventory.slots?.[idx]?.name ?? null

  const entities = Object.values(bot.entities ?? {})
    .filter(e => e !== bot.entity && e.position && pos.distanceTo(e.position) <= 16)
    .map(e => ({ entityId: e.id, name: e.username ?? e.name ?? e.type, type: e.type, position: roundPos(e.position), distance: Math.round(pos.distanceTo(e.position) * 10) / 10 }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10)

  const inventory = inventoryCounts(bot)
  const toolDurability = bot.inventory.items().flatMap(item => {
    if (!item.maxDurability) return []
    try {
      const used = item.durabilityUsed ?? 0
      return [{ name: item.name, remaining: Math.max(0, item.maxDurability - used), maximum: item.maxDurability }]
    } catch {
      return []
    }
  })
  const state = {
    position: roundPos(pos),
    motion: { onGround: bot.entity.onGround, velocity: roundPos(bot.entity.velocity), physicsEnabled: bot.physicsEnabled,
      supportBlock: bot.blockAt(pos.floored().offset(0, -1, 0))?.name ?? null },
    dimension: bot.game?.dimension ?? null,
    gameMode: bot.game?.gameMode ?? null,
    health: bot.health ?? null,
    food: bot.food ?? null,
    timeOfDay: bot.time?.timeOfDay ?? null,
    isDay: bot.time ? bot.time.timeOfDay < 13000 : null,
    inventory,
    toolDurability,
    emptySlots: bot.inventory.emptySlotCount?.() ?? null,
    equipment,
    nearbyBlocks,
    notable,
    entities,
    savedLocations: ctx.locations?.list().map(l => l.name) ?? []
  }
  const items = Object.entries(inventory).map(([k, v]) => `${v} ${k}`).join(', ') || 'empty inventory'
  return ok(`At ${state.position.x}, ${state.position.y}, ${state.position.z}; health ${state.health}, food ${state.food}; ${items}`, state)
}
