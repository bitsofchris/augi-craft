// Equipment and container tools. Container logic adapted from mindcraft's
// putInChest/takeFromChest (MIT, see THIRD_PARTY_NOTICES.md).
import { ErrorCategory, fail, ok } from './result.js'
import { Vec3 } from 'vec3'
import { navigateTo } from './navigate.js'
import { describeBlock, findBlocks, resolveBlockNames } from './world.js'

const ARMOR_DEST = { _helmet: 'head', _chestplate: 'torso', _leggings: 'legs', _boots: 'feet' }
const CONTAINERS = ['chest', 'trapped_chest', 'barrel']

/** equip_item: equip a named item, or the best tool for a block type. */
export async function equipItem (ctx, { item, destination, forBlock }) {
  const { bot } = ctx
  if (forBlock) {
    const names = resolveBlockNames(bot.registry, forBlock)
    const [block] = findBlocks(bot, names, { maxDistance: 64, count: 1 })
    if (!block) return fail(ErrorCategory.NOT_FOUND, `No ${forBlock} nearby to choose a tool for`)
    await bot.tool.equipForBlock(block, {})
    return ok(`Holding ${bot.heldItem?.name ?? 'nothing'} for ${forBlock}`, { hand: bot.heldItem?.name ?? null })
  }
  if (!item) return fail(ErrorCategory.INVALID_ARGUMENT, 'Provide item or forBlock')
  const stack = bot.inventory.items().find(i => i.name === item)
  if (!stack) return fail(ErrorCategory.MISSING_MATERIALS, `No ${item} in inventory`)
  const dest = destination ?? Object.entries(ARMOR_DEST).find(([suffix]) => item.endsWith(suffix))?.[1] ?? 'hand'
  await bot.equip(stack, dest)
  return ok(`Equipped ${item} to ${dest}`, { item, destination: dest })
}

async function openNearestContainer (ctx, at) {
  const { bot } = ctx
  let block
  if (at) {
    block = bot.blockAt(new Vec3(at.x, at.y, at.z))
    if (!block || !CONTAINERS.includes(block.name)) return { error: fail(ErrorCategory.NOT_FOUND, `No container at ${at.x}, ${at.y}, ${at.z}`) }
  } else {
    ;[block] = findBlocks(bot, CONTAINERS, { maxDistance: 32, count: 1 })
    if (!block) return { error: fail(ErrorCategory.NOT_FOUND, 'No chest or barrel within 32 blocks') }
  }
  const approach = await navigateTo(ctx, { ...block.position, range: 3, walkOnly: true })
  if (!approach.ok) return { error: approach }
  const container = await bot.openContainer(block)
  return { block, container }
}

function contents (container) {
  const counts = {}
  for (const i of container.containerItems()) counts[i.name] = (counts[i.name] ?? 0) + i.count
  return counts
}

/** Inspect authorized storage without withdrawing a probe item. */
export async function inspectContainer (ctx, { x, y, z } = {}) {
  if ([x, y, z].some(v => v !== undefined) && ![x, y, z].every(Number.isInteger)) return fail(ErrorCategory.INVALID_ARGUMENT, 'Provide all integer container coordinates or none')
  const { block, container, error } = await openNearestContainer(ctx, Number.isInteger(x) ? { x, y, z } : null)
  if (error) return error
  try {
    ctx.checkAbort()
    return ok('Inspected container; no items withdrawn', { container: describeBlock(ctx.bot, block), contents: contents(container) })
  } finally { container.close() }
}

/** deposit_items: put items into the nearest (or given) chest. count omitted = all. */
export async function depositItems (ctx, { item, count, x, y, z }) {
  const { bot } = ctx
  const have = bot.inventory.items().filter(i => i.name === item).reduce((s, i) => s + i.count, 0)
  if (have === 0) return fail(ErrorCategory.MISSING_MATERIALS, `No ${item} in inventory`)
  const amount = Math.min(count ?? have, have)
  const { block, container, error } = await openNearestContainer(ctx, Number.isFinite(x) ? { x, y, z } : null)
  if (error) return error
  try {
    await container.deposit(bot.registry.itemsByName[item].id, null, amount)
    return ok(`Deposited ${amount} ${item}`, { container: describeBlock(bot, block), deposited: amount, contents: contents(container) })
  } catch (err) {
    return fail(ErrorCategory.INVENTORY_FULL, `Deposit failed: ${err.message}`, { container: describeBlock(bot, block) })
  } finally {
    container.close()
  }
}

/** withdraw_items: take items from the nearest (or given) chest. count omitted = all. */
export async function withdrawItems (ctx, { item, count, x, y, z }) {
  const { bot } = ctx
  const { block, container, error } = await openNearestContainer(ctx, Number.isFinite(x) ? { x, y, z } : null)
  if (error) return error
  try {
    const available = contents(container)[item] ?? 0
    if (available === 0) return fail(ErrorCategory.NOT_FOUND, `No ${item} in container`, { contents: contents(container) })
    const amount = Math.min(count ?? available, available)
    await container.withdraw(bot.registry.itemsByName[item].id, null, amount)
    return ok(`Withdrew ${amount} ${item}`, { container: describeBlock(bot, block), withdrawn: amount, contents: contents(container) })
  } catch (err) {
    return fail(ErrorCategory.INVENTORY_FULL, `Withdraw failed: ${err.message}`, { container: describeBlock(bot, block) })
  } finally {
    container.close()
  }
}
