import { ErrorCategory, ToolError } from './result.js'
import itemLoader from 'prismarine-item'

/** Bounded, cancellable equivalent of the upstream full-menu-state request. */
export async function syncCraftWindow (ctx, window, { cleanup = false } = {}) {
  const { bot } = ctx
  // Deterministic test doubles can supply their own authoritative state.
  if (!bot._client) return bot._syncWindow(window)
  const Item = itemLoader(bot.registry)
  await new Promise((resolve, reject) => {
    const event = `setWindowItems:${window.id}`
    const finish = err => {
      clearInterval(timer)
      bot.removeListener(event, received)
      if (err) reject(err); else resolve()
    }
    const received = () => finish()
    const started = Date.now()
    const timer = setInterval(() => {
      try {
        if (!cleanup) ctx.checkAbort()
        if (Date.now() - started > 3_000) throw new ToolError(ErrorCategory.GAME_ERROR, 'Server did not synchronize crafting inventory')
      } catch (err) { finish(err) }
    }, 50)
    bot.once(event, received)
    try {
      if (!cleanup) ctx.checkAbort()
      bot._client.write('window_click', { windowId: window.id, stateId: -1, slot: -999, mouseButton: 2, mode: 5, changedSlots: [], cursorItem: Item.toNotch(window.selectedItem) })
    } catch (err) { finish(err) }
  })
}

/** Craft one recipe with authoritative menu state after every click. */
export async function confirmedCraftOnce (ctx, recipe, table) {
  const { bot } = ctx
  if (!bot._syncWindow) throw new ToolError(ErrorCategory.GAME_ERROR, 'Server-confirmed inventory synchronization is unavailable')
  let window = bot.inventory
  const sync = async () => { ctx.checkAbort(); await syncCraftWindow(ctx, window); ctx.checkAbort() }
  const click = async (slot, button = 0, verified = () => true) => {
    ctx.checkAbort()
    await bot.clickWindow(slot, button, 0)
    const started = Date.now()
    // A full-state packet from an earlier correction can satisfy the
    // upstream synchronization listener. Wait for this click's actual
    // postcondition; never repeat the click and risk consuming twice.
    do {
      await sync()
      if (verified()) return
      if (Date.now() - started > 3_000) throw new ToolError(ErrorCategory.GAME_ERROR, `Server did not confirm crafting click in slot ${slot}`)
      await bot.waitForTicks(1)
    } while (true)
  }
  const stashCursor = async () => {
    const held = window.selectedItem
    if (!held) return
    let dest = window.firstEmptySlotRange(window.inventoryStart, window.inventoryEnd)
    if (dest === null) {
      const item = window.slots.slice(window.inventoryStart, window.inventoryEnd)
        .find(i => i && i.type === held.type && i.metadata === held.metadata && i.count + held.count <= i.stackSize)
      dest = item?.slot ?? null
    }
    if (dest === null) throw new ToolError(ErrorCategory.INVENTORY_FULL, 'No room to return the crafting cursor stack')
    const expectedCount = (window.slots[dest]?.count ?? 0) + held.count
    await click(dest, 0, () => !window.selectedItem && window.slots[dest]?.type === held.type && window.slots[dest]?.count === expectedCount)
    if (window.selectedItem) throw new ToolError(ErrorCategory.GAME_ERROR, 'Server did not return the cursor stack to inventory')
  }
  try {
    if (bot.currentWindow) {
      await bot.closeWindow(bot.currentWindow)
      await syncCraftWindow(ctx, bot.inventory)
    }
    if (table) {
      window = await new Promise((resolve, reject) => {
        const cleanup = () => { clearInterval(timer); bot.removeListener('windowOpen', opened) }
        const opened = value => { cleanup(); resolve(value) }
        const started = Date.now()
        const timer = setInterval(() => {
          try {
            ctx.checkAbort()
            if (Date.now() - started > 5_000) throw new ToolError(ErrorCategory.NO_STATION, 'Crafting table did not open within five seconds')
          } catch (err) { cleanup(); reject(err) }
        }, 100)
        bot.once('windowOpen', opened)
        Promise.resolve().then(() => bot.activateBlock(table)).catch(err => { cleanup(); reject(err) })
      })
      if (window.type !== 'minecraft:crafting') throw new ToolError(ErrorCategory.NO_STATION, `Expected a crafting table, got ${window.type}`)
    }
    await sync()
    await stashCursor()
    const width = table ? 3 : 2
    // Recover any leftover grid items before laying out a new recipe.
    for (let slot = 1; slot <= width * width; slot++) {
      if (!window.slots[slot]) continue
      const old = window.slots[slot]
      await click(slot, 0, () => !window.slots[slot] && window.selectedItem?.type === old.type && window.selectedItem?.count === old.count)
      await stashCursor()
    }
    const ingredients = []
    const used = new Set()
    for (const [y, row] of (recipe.inShape ?? []).entries()) {
      for (const [x, ingredient] of row.entries()) {
        const slot = 1 + x + width * y
        if (ingredient.id < 0) continue
        ingredients.push({ slot, ingredient }); used.add(slot)
      }
    }
    const free = Array.from({ length: width * width }, (_, i) => i + 1).filter(s => !used.has(s))
    for (const ingredient of recipe.ingredients ?? []) ingredients.push({ slot: free.shift(), ingredient })
    for (const { slot, ingredient } of ingredients) {
      if (!slot || slot > width * width) throw new ToolError(ErrorCategory.INVALID_ARGUMENT, 'Recipe does not fit this crafting grid')
      if (!window.selectedItem || window.selectedItem.type !== ingredient.id || (ingredient.metadata != null && window.selectedItem.metadata !== ingredient.metadata)) {
        await stashCursor()
        const source = window.findInventoryItem(ingredient.id, ingredient.metadata)
        if (!source) throw new ToolError(ErrorCategory.MISSING_MATERIALS, 'Crafting ingredient disappeared from inventory')
        const sourceCount = source.count
        await click(source.slot, 0, () => window.selectedItem?.type === ingredient.id && window.selectedItem?.count === sourceCount)
      }
      const remaining = window.selectedItem.count - 1
      await click(slot, 1, () => window.slots[slot]?.type === ingredient.id && window.slots[slot]?.count === 1 &&
        (remaining === 0 ? !window.selectedItem : window.selectedItem?.type === ingredient.id && window.selectedItem?.count === remaining))
      if (window.slots[slot]?.type !== ingredient.id || window.slots[slot]?.count !== 1) throw new ToolError(ErrorCategory.GAME_ERROR, `Server rejected ingredient in grid slot ${slot}`)
    }
    await stashCursor()
    const result = window.slots[0]
    if (result?.type !== recipe.result.id || result?.count !== recipe.result.count) {
      throw new ToolError(ErrorCategory.GAME_ERROR, 'Server crafting output does not match the requested recipe')
    }
    // Keep one free inventory slot for unstackable tools and weapons.
    if (window.firstEmptySlotRange(window.inventoryStart, window.inventoryEnd) === null) throw new ToolError(ErrorCategory.INVENTORY_FULL, 'Crafting requires a free inventory slot')
    await click(0, 0, () => window.selectedItem?.type === recipe.result.id && window.selectedItem?.count === recipe.result.count)
    if (window.selectedItem?.type !== recipe.result.id || window.selectedItem?.count !== recipe.result.count) throw new ToolError(ErrorCategory.GAME_ERROR, 'Server did not place the crafted output on the cursor')
    await stashCursor()
  } finally {
    if (table && bot.currentWindow === window) await bot.closeWindow(window)
    // Closing returns unused ingredients; reconcile the actual player inventory.
    await syncCraftWindow(ctx, bot.inventory, { cleanup: true })
  }
}
