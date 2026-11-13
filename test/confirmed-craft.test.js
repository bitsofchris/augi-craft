import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { install26_3WindowStateFix } from '../runtime/bot/inventory-compat.js'
import { confirmedCraftOnce, syncCraftWindow } from '../runtime/tools/confirmed-craft.js'
import minecraftData from 'minecraft-data'

const recipe = { inShape: [[{ id: 1 }, { id: 1 }, { id: 1 }], [{ id: -1 }, { id: 2 }, { id: -1 }], [{ id: -1 }, { id: 2 }, { id: -1 }]], result: { id: 3, count: 1 } }
const copy = value => structuredClone(value)
const item = (type, count) => ({ type, count, metadata: 0, stackSize: type === 3 ? 1 : 64 })

function fixture ({ wrongOutput = false, staleForever = false } = {}) {
  const bot = new EventEmitter()
  const server = { slots: Array(46).fill(null), cursor: null }
  server.slots[10] = item(1, 12)
  server.slots[11] = item(2, 8)
  function window (id, type) {
    return { id, type, slots: Array(46).fill(null), inventoryStart: 10, inventoryEnd: 46, selectedItem: null,
      firstEmptySlotRange (start, end) { for (let i = start; i < end; i++) if (!this.slots[i]) return i; return null },
      findInventoryItem (type) { return this.slots.slice(10).find(i => i?.type === type) }
    }
  }
  bot.inventory = window(0, 'minecraft:inventory')
  let prior = null
  let syncs = 0
  const clicks = []
  const load = (w, snapshot) => {
    w.slots = copy(snapshot.slots).map((value, slot) => value ? { ...value, slot } : null)
    w.selectedItem = copy(snapshot.cursor)
  }
  load(bot.inventory, server)
  bot.activateBlock = async () => {
    bot.currentWindow = window(1, 'minecraft:crafting')
    load(bot.currentWindow, server)
    bot.emit('windowOpen', bot.currentWindow)
  }
  bot._syncWindow = async w => {
    syncs++
    if (prior && w.id === 1) { load(w, prior); if (!staleForever) prior = null } else load(w, server)
  }
  bot.clickWindow = async (slot, button) => {
    clicks.push(slot)
    prior = copy(server)
    const old = server.slots[slot]
    if (slot === 0) {
      server.cursor = old; server.slots[0] = null
      for (let i = 1; i <= 9; i++) server.slots[i] = null
    } else if (button === 1) {
      server.slots[slot] = item(server.cursor.type, 1)
      server.cursor.count--
      if (!server.cursor.count) server.cursor = null
    } else if (!server.cursor) {
      server.cursor = old; server.slots[slot] = null
    } else if (!old) {
      server.slots[slot] = server.cursor; server.cursor = null
    } else if (old.type === server.cursor.type) {
      old.count += server.cursor.count; server.cursor = null
    } else {
      server.slots[slot] = server.cursor; server.cursor = old
    }
    if (slot !== 0) {
      const valid = [1, 2, 3].every(s => server.slots[s]?.type === 1) && [5, 8].every(s => server.slots[s]?.type === 2)
      server.slots[0] = valid ? item(wrongOutput ? 4 : 3, 1) : null
    }
  }
  bot.waitForTicks = async () => new Promise(resolve => setTimeout(resolve, 1))
  bot.closeWindow = async () => {
    for (let slot = 1; slot <= 9; slot++) if (server.slots[slot]) {
      const dest = server.slots.findIndex((i, n) => n >= 10 && !i)
      server.slots[dest] = server.slots[slot]; server.slots[slot] = null
    }
    if (server.cursor) {
      const dest = server.slots.findIndex((i, n) => n >= 10 && !i)
      server.slots[dest] = server.cursor; server.cursor = null
    }
    server.slots[0] = null; bot.currentWindow = null; prior = null
  }
  const ctx = { bot, checkAbort () {} }
  const counts = () => Object.fromEntries([1, 2, 3].map(type => [type, server.slots.slice(10).filter(i => i?.type === type).reduce((n, i) => n + i.count, 0)]))
  return { bot, ctx, counts, clicks, server, syncs: () => syncs }
}

test('window revisions remain isolated from inventory/offhand packets and reset on menu reuse', () => {
  const client = new EventEmitter(), sent = []
  client.write = (name, packet) => sent.push(packet)
  const bot = { version: '26.3', _client: client }
  install26_3WindowStateFix(bot)
  install26_3WindowStateFix(bot)
  client.emit('window_items', { windowId: 1, stateId: 22 })
  client.emit('set_slot', { windowId: 0, stateId: 16, slot: 45 })
  client.write('window_click', { windowId: 1, stateId: 16 })
  assert.equal(sent.at(-1).stateId, 22)
  client.write('window_click', { windowId: 1, stateId: -1 })
  assert.equal(sent.at(-1).stateId, -1)
  client.emit('open_window', { windowId: 1 })
  client.write('window_click', { windowId: 1, stateId: 1 })
  assert.equal(sent.at(-1).stateId, 1)
  assert.equal(client.listenerCount('window_items'), 1)
})

test('repeated crafts survive an earlier full-window correction without repeating consuming clicks', async () => {
  const f = fixture()
  await confirmedCraftOnce(f.ctx, recipe, {})
  await confirmedCraftOnce(f.ctx, recipe, {})
  assert.deepEqual(f.counts(), { 1: 6, 2: 4, 3: 2 })
  assert.equal(f.clicks.filter(s => s === 0).length, 2)
  assert.ok(f.syncs() > f.clicks.length)
  assert.equal(f.bot.currentWindow, null)
  assert.equal(f.bot.listenerCount('windowOpen'), 0)
})

test('wrong server output is never taken; closing recovers the ingredients', async () => {
  const f = fixture({ wrongOutput: true })
  await assert.rejects(confirmedCraftOnce(f.ctx, recipe, {}), /output does not match/)
  assert.deepEqual(f.counts(), { 1: 12, 2: 8, 3: 0 })
  assert.equal(f.clicks.includes(0), false)
  assert.equal(f.bot.currentWindow, null)
})

test('cancellation closes the menu and preserves ingredients', async () => {
  const f = fixture()
  f.ctx.checkAbort = () => { if (f.clicks.length) throw new Error('cancelled') }
  await assert.rejects(confirmedCraftOnce(f.ctx, recipe, {}), /cancelled/)
  assert.deepEqual(f.counts(), { 1: 12, 2: 8, 3: 0 })
  assert.equal(f.bot.currentWindow, null)
})

test('missing material stops without taking output and returns placed ingredients', async () => {
  const f = fixture()
  f.server.slots[11] = null
  await assert.rejects(confirmedCraftOnce(f.ctx, recipe, {}), /ingredient disappeared/)
  assert.deepEqual(f.counts(), { 1: 12, 2: 0, 3: 0 })
  assert.equal(f.clicks.includes(0), false)
})

test('cancelling a pending synchronization removes its listener', async () => {
  const bot = new EventEmitter()
  bot.registry = minecraftData('26.3')
  bot._client = { write () {} }
  let cancelled = false
  const ctx = { bot, checkAbort () { if (cancelled) throw new Error('cancelled') } }
  const request = syncCraftWindow(ctx, { id: 7, selectedItem: null })
  assert.equal(bot.listenerCount('setWindowItems:7'), 1)
  cancelled = true
  await assert.rejects(request, /cancelled/)
  assert.equal(bot.listenerCount('setWindowItems:7'), 0)
})

test('unconfirmed clicks stop rather than taking output or clicking twice', async () => {
  const f = fixture({ staleForever: true })
  await assert.rejects(confirmedCraftOnce(f.ctx, recipe, {}), /did not confirm/)
  assert.equal(f.clicks.length, 1)
  assert.deepEqual(f.counts(), { 1: 12, 2: 8, 3: 0 })
})
