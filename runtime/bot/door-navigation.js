import { Vec3 } from 'vec3'

/** Pathfinder treats doors as full blocks even when their panel is open.
 * Admit straight movement through open doorways; physics retains real shapes.
 */
export function installOpenDoorNavigation (movements) {
  if (movements._augiOpenDoorNavigation) return movements
  movements._augiOpenDoorNavigation = true
  const getBlock = movements.getBlock
  movements.getBlock = function (pos, dx, dy, dz) {
    const block = getBlock.call(this, pos, dx, dy, dz)
    const props = block.getProperties?.()
    if (!block.name?.endsWith('_door') || block.name === 'iron_door' || props?.open !== true || this.blocksToAvoid?.has(block.type)) return block
    // An open panel lies along the doorway's side. Crossing that side is still
    // blocked; the safe path is along the closed door's facing axis.
    const along = ['north', 'south'].includes(props.facing) ? dx === 0 : dz === 0
    if (!along) return block
    return { ...block, safe: true, physical: false, replaceable: false, openable: false, height: pos.y + dy }
  }
  return movements
}

/** Upstream post-processing aims at the top of the thin open door panel.
 * Restore the floor-level center for admitted doorway nodes, without changing
 * world collision geometry or the player's position.
 */
export function normalizeDoorPath (bot, result) {
  for (const node of result.path ?? []) {
    if (node.toBreak?.length || node.toPlace?.length || typeof node.hash !== 'string') continue
    const xyz = node.hash.split(',').map(Number)
    if (xyz.length !== 3 || !xyz.every(Number.isFinite)) continue
    const [x, y, z] = xyz
    const block = bot.blockAt(new Vec3(x, y, z))
    const props = block?.getProperties?.()
    if (!block?.name.endsWith('_door') || block.name === 'iron_door' || props?.open !== true || props.half !== 'lower') continue
    node.x = x + 0.5; node.y = y; node.z = z + 0.5
  }
  return result
}

export function installDoorPathNormalization (bot) {
  if (bot._augiDoorPathNormalization) return
  bot._augiDoorPathNormalization = true
  const getPathTo = bot.pathfinder.getPathTo
  bot.pathfinder.getPathTo = function (...args) { return normalizeDoorPath(bot, getPathTo.apply(this, args)) }
  // Partial searches resume inside pathfinder without calling getPathTo.
  bot.on('path_update', result => normalizeDoorPath(bot, result))
}
