import { Vec3 } from 'vec3'
import { ErrorCategory, fail, ok } from './result.js'

/** Read actual doorway geometry before selecting approach/inside waypoints. */
export async function inspectDoor (ctx, { x, y, z }) {
  const { bot } = ctx
  ctx.checkAbort()
  const position = new Vec3(x, y, z)
  const door = bot.blockAt(position)
  if (!door?.name.endsWith('_door')) return fail(ErrorCategory.INVALID_ARGUMENT, 'Target must be an observed door')
  if (bot.entity.position.distanceTo(position) > 16) return fail(ErrorCategory.UNREACHABLE, 'Inspect a doorway within 16 blocks')
  const describe = p => {
    const b = bot.blockAt(p)
    return b ? { name: b.name, boundingBox: b.boundingBox, properties: b.getProperties?.() ?? {} } : null
  }
  const cells = []
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const p = position.offset(dx, 0, dz)
    cells.push({ x: p.x, y: p.y, z: p.z, floor: describe(p.offset(0, -1, 0)), feet: describe(p), head: describe(p.offset(0, 1, 0)) })
  }
  return ok('Inspected doorway and nearby footing without moving', { position: { x, y, z }, door: describe(position), cells })
}

// Interact in place: never navigate, dig, or place to reach a door.
export async function setDoor (ctx, { x, y, z, open = true }) {
  const { bot } = ctx
  const position = new Vec3(x, y, z)
  const read = () => bot.blockAt(position)
  let block = read()
  if (!block || !block.name.endsWith('_door')) return fail(ErrorCategory.INVALID_ARGUMENT, 'Target must be a door')
  if (block.name === 'iron_door') return fail(ErrorCategory.INVALID_ARGUMENT, 'Iron doors require a redstone control')
  const name = block.name
  const observations = () => ({ block: name, position: { x, y, z }, open: read()?.getProperties?.().open })
  const reachable = () => bot.entity.position.distanceTo(position.offset(0.5, 0.5, 0.5)) <= 4.5 && bot.canSeeBlock(block)
  if (!reachable()) return fail(ErrorCategory.UNREACHABLE, 'Door must be visible and within 4.5 blocks; approach with walkOnly navigation', observations())
  if (typeof block.getProperties?.().open !== 'boolean') return fail(ErrorCategory.GAME_ERROR, 'Door state is unavailable')
  if (block.getProperties().open === open) return ok(`Door already ${open ? 'open' : 'closed'}`, observations())

  ctx.checkAbort()
  const sneaking = bot.getControlState('sneak')
  try {
    // Sneaking with a held block places it instead of opening the door.
    if (sneaking) bot.setControlState('sneak', false)
    await bot.lookAt(position.offset(0.5, 0.5, 0.5))
    ctx.checkAbort()
    block = read()
    if (block?.name !== name || !reachable()) return fail(ErrorCategory.UNREACHABLE, 'Door changed or is no longer reachable')
    if (block.getProperties().open !== open) await bot.activateBlock(block)
    for (let tick = 0; tick < 20; tick++) {
      ctx.checkAbort()
      block = read()
      if (block?.name !== name) return fail(ErrorCategory.GAME_ERROR, 'Door disappeared during interaction')
      if (block.getProperties().open === open) return ok(`Door ${open ? 'opened' : 'closed'}`, observations())
      await bot.waitForTicks(1)
    }
    return fail(ErrorCategory.TIMEOUT, 'Requested door state was not observed', observations())
  } finally {
    if (sneaking) bot.setControlState('sneak', true)
  }
}
