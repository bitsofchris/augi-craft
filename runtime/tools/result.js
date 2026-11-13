// Structured results shared by every game tool.
//
// Every tool returns the same envelope so the agent can reason about outcomes
// uniformly:
//   { ok, tool, summary, error: {category, message} | null,
//     changes: { inventory, position }, observations, durationMs }

export const ErrorCategory = Object.freeze({
  NOT_CONNECTED: 'not_connected',
  INVALID_ARGUMENT: 'invalid_argument',
  NOT_FOUND: 'not_found',
  UNREACHABLE: 'unreachable',
  MISSING_MATERIALS: 'missing_materials',
  MISSING_TOOL: 'missing_tool',
  NO_STATION: 'no_station',
  INVENTORY_FULL: 'inventory_full',
  PARTIAL: 'partial',
  TIMEOUT: 'timeout',
  INTERRUPTED: 'interrupted',
  BUSY: 'busy',
  GAME_ERROR: 'game_error'
})

/** Error thrown inside a tool to fail with a specific category. */
export class ToolError extends Error {
  constructor (category, message, observations = {}) {
    super(message)
    this.name = 'ToolError'
    this.category = category
    this.observations = observations
  }
}

/** Successful tool outcome. `observations` is free-form tool-specific data. */
export function ok (summary, observations = {}) {
  return { ok: true, summary, error: null, observations }
}

/** Failed tool outcome (returned rather than thrown). */
export function fail (category, message, observations = {}) {
  return { ok: false, summary: message, error: { category, message }, observations }
}

/** Map of item name -> total count across the bot's inventory. */
export function inventoryCounts (bot) {
  const counts = {}
  if (!bot?.inventory) return counts
  for (const item of bot.inventory.items()) {
    counts[item.name] = (counts[item.name] ?? 0) + item.count
  }
  return counts
}

/** Difference between two inventory count maps, omitting unchanged items. */
export function diffCounts (before, after) {
  const delta = {}
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const d = (after[name] ?? 0) - (before[name] ?? 0)
    if (d !== 0) delta[name] = d
  }
  return delta
}

export function roundPos (p) {
  if (!p) return null
  return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, z: Math.round(p.z * 10) / 10 }
}

/** Classify an arbitrary error thrown by mineflayer or its plugins. */
export function categorize (err) {
  if (err instanceof ToolError) return err.category
  const msg = `${err?.name ?? ''} ${err?.message ?? err}`.toLowerCase()
  if (msg.includes('nopath') || msg.includes('no path') || msg.includes('goal was changed') || msg.includes('unreachable')) return ErrorCategory.UNREACHABLE
  if (msg.includes('nochests') || msg.includes('inventory full') || msg.includes('destination full')) return ErrorCategory.INVENTORY_FULL
  if (msg.includes('timeout') || msg.includes('timed out')) return ErrorCategory.TIMEOUT
  if (msg.includes('interrupt') || msg.includes('cancel') || msg.includes('stopped') || msg.includes('aborted')) return ErrorCategory.INTERRUPTED
  return ErrorCategory.GAME_ERROR
}
