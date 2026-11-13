// A small deterministic stand-in for a Mineflayer bot. It uses the real
// minecraft-data registry and prismarine-recipe so crafting logic is tested
// against real recipes, but the world is a sparse map we control.
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { Vec3 } from 'vec3'

const require = createRequire(import.meta.url)
export const VERSION = '1.21.11'
const registry = require('minecraft-data')(VERSION)
const { Recipe } = require('prismarine-recipe')(registry)

const key = p => `${p.x},${p.y},${p.z}`

export class FakeBot extends EventEmitter {
  constructor ({ inventory = {}, blocks = {}, position = [0, 64, 0], groundY = 63, hiddenBlocks = [] } = {}) {
    super()
    this.username = 'Augi'
    this.version = VERSION
    this.registry = registry
    this.groundY = groundY
    this.world = new Map() // "x,y,z" -> block name
    this.props = new Map() // "x,y,z" -> block state properties ({ age })
    this.extraDrops = {} // block name -> item it drops (random loot such as seeds from grass)
    this.hiddenBlocks = new Set(hiddenBlocks)
    for (const [k, name] of Object.entries(blocks)) this.world.set(k, name)
    this.entity = { position: new Vec3(...position) }
    this.entities = {}
    this.health = 20
    this.food = 20
    this.game = { dimension: 'overworld', gameMode: 'survival' }
    this.time = { timeOfDay: 1000 }
    this.heldItem = null
    this.counts = { ...inventory }
    this.chests = new Map() // "x,y,z" -> {name: count}
    this.unreachable = new Set() // block keys collectBlock fails on
    this.calls = []
    this.chatSent = []
    this.smeltDelayMs = 0
    this.controlStates = {}

    const bot = this
    this.inventory = {
      items: () => Object.entries(bot.counts).filter(([, c]) => c > 0)
        .map(([name, count]) => ({ name, count, type: registry.itemsByName[name].id })),
      slots: [],
      emptySlotCount: () => 36 - Object.values(bot.counts).filter(c => c > 0).length
    }
    this.pathfinder = {
      movements: { canDig: true, allow1by1towers: true, scafoldingBlocks: [1] },
      setMovements: movements => { bot.pathfinder.movements = movements },
      goto: async (goal) => {
        bot.calls.push(['goto', goal.x, goal.y, goal.z])
        if (bot.pathBlocked) throw new Error('No path to the goal!')
        bot.entity.position = new Vec3(goal.x + 1, goal.y ?? bot.entity.position.y, goal.z)
        bot.onArrive?.(bot.entity.position)
      },
      stop: () => bot.calls.push(['pathfinder.stop']),
      setGoal: goal => bot.calls.push(['setGoal', goal])
    }
    this.tool = {
      equipForBlock: async (block) => {
        if (bot.hangOnEmptyEquip && bot.inventory.items().length === 0) await new Promise(() => {})
        const tools = Object.keys(block.harvestTools ?? {}).map(Number)
        const best = bot.inventory.items().find(i => tools.includes(i.type))
        if (best) bot.heldItem = best
      }
    }
    this.collectBlock = {
      collect: async (block) => {
        bot.calls.push(['collect', key(block.position)])
        if (bot.hang) await new Promise(() => {})
        if (bot.unreachable.has(key(block.position))) throw new Error('No path to the goal!')
        bot.world.set(key(block.position), 'air')
        for (const id of registry.blocksByName[block.name].drops) bot.add(registry.items[id].name, 1)
      },
      cancelTask: async () => bot.calls.push(['collectBlock.cancel'])
    }
  }

  async dig (block) {
    this.calls.push(['dig', key(block.position)])
    if (this.hang) await new Promise(() => {})
    if (this.unreachable.has(key(block.position))) throw new Error('No path to the goal!')
    this.world.set(key(block.position), 'air')
    for (const id of registry.blocksByName[block.name].drops) this.add(registry.items[id].name, 1)
    if (this.extraDrops[block.name]) this.add(this.extraDrops[block.name], 1)
  }

  // Hoe on dirt tills it; seeds on farmland plant wheat above it.
  async activateBlock (block) {
    this.calls.push(['activateBlock', key(block.position), this.heldItem?.name])
    const above = block.position.offset(0, 1, 0)
    const held = this.heldItem?.name ?? ''
    if (held.endsWith('_hoe') && ['dirt', 'grass_block'].includes(block.name) && this.nameAt(above) === 'air') this.world.set(key(block.position), 'farmland')
    if (held === 'wheat_seeds' && block.name === 'farmland' && this.nameAt(above) === 'air' && this.counts.wheat_seeds > 0) {
      this.world.set(key(above), 'wheat')
      this.props.set(key(above), { age: 0 })
      this.add('wheat_seeds', -1)
    }
  }

  async waitForTicks () {}

  clearControlStates () { this.controlStates = {}; this.calls.push(['clearControlStates']) }
  canSeeBlock (block) { return !this.hiddenBlocks.has(key(block.position)) }

  add (name, n) { this.counts[name] = (this.counts[name] ?? 0) + n }

  nameAt (p) {
    return this.world.get(key(p)) ?? (p.y <= this.groundY ? 'dirt' : 'air')
  }

  blockAt (p) {
    const pos = new Vec3(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))
    const name = this.nameAt(pos)
    const def = registry.blocksByName[name]
    return {
      name,
      type: def.id,
      position: pos,
      getProperties: () => ({ ...this.props.get(key(pos)) }),
      boundingBox: def.boundingBox,
      harvestTools: def.harvestTools,
      canHarvest: (held) => !def.harvestTools || Boolean(held != null && def.harvestTools[held])
    }
  }

  findBlocks ({ matching, maxDistance, count }) {
    const ids = new Set(Array.isArray(matching) ? matching : [matching])
    const origin = this.entity.position.floored()
    const seen = new Set()
    const out = []
    const consider = (pos) => {
      const k = key(pos)
      if (seen.has(k)) return
      seen.add(k)
      if (pos.distanceTo(origin) > maxDistance) return
      if (ids.has(registry.blocksByName[this.nameAt(pos)].id)) out.push(pos)
    }
    for (const k of this.world.keys()) consider(new Vec3(...k.split(',').map(Number)))
    const r = Math.min(3, maxDistance)
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) consider(origin.offset(dx, dy, dz))
    out.sort((a, b) => a.distanceTo(origin) - b.distanceTo(origin))
    return out.slice(0, count)
  }

  recipesAll (id) { return Recipe.find(id, null) }

  recipesFor (id, meta, min, table) {
    return Recipe.find(id, null).filter(r => (table || !r.requiresTable) &&
      r.delta.every(d => d.count >= 0 || (this.counts[registry.items[d.id].name] ?? 0) >= -d.count))
  }

  async craft (recipe, count, table) {
    this.calls.push(['craft', registry.items[recipe.result.id].name, count, Boolean(table)])
    if (recipe.requiresTable && !table) throw new Error('Recipe requires craftingTable, but one was not supplied')
    for (const d of recipe.delta) this.add(registry.items[d.id].name, d.count * count)
  }

  async equip (item, dest) {
    this.calls.push(['equip', item.name, dest])
    if (dest === 'hand') this.heldItem = item
  }

  async lookAt () {}

  async placeBlock (reference, face) {
    if (['crafting_table', 'furnace', 'chest'].includes(reference.name) && !this.controlStates.sneak) {
      throw new Error(`Opened ${reference.name} instead of placing`)
    }
    const dest = reference.position.plus(face)
    this.world.set(key(dest), this.heldItem.name)
    this.add(this.heldItem.name, -1)
  }

  async openContainer (block) {
    const k = key(block.position)
    if (!this.chests.has(k)) this.chests.set(k, {})
    const store = this.chests.get(k)
    const bot = this
    return {
      containerItems: () => Object.entries(store).filter(([, c]) => c > 0).map(([name, count]) => ({ name, count, type: registry.itemsByName[name].id })),
      deposit: async (id, meta, n) => { const name = registry.items[id].name; bot.add(name, -n); store[name] = (store[name] ?? 0) + n },
      withdraw: async (id, meta, n) => { const name = registry.items[id].name; store[name] -= n; bot.add(name, n) },
      close: () => {}
    }
  }

  async openFurnace () {
    const bot = this
    const f = { input: null, fuel: null, output: null }
    return {
      inputItem: () => f.input,
      fuelItem: () => f.fuel,
      outputItem: () => f.output,
      putFuel: async (id, m, n) => { const name = registry.items[id].name; bot.add(name, -n); f.fuel = { name, count: n } },
      putInput: async (id, m, n) => {
        const name = registry.items[id].name
        bot.add(name, -n)
        // Instant smelting: everything is done by the first poll.
        f.output = { name: { raw_iron: 'iron_ingot', cobblestone: 'stone' }[name] ?? 'charcoal', count: n }
        f.fuel = null
      },
      takeOutput: async () => { const o = f.output; f.output = null; bot.add(o.name, o.count); return o },
      takeInput: async () => {},
      takeFuel: async () => {},
      close: () => {}
    }
  }

  chat (msg) { this.chatSent.push(msg) }
  getControlState (name) { return this.controlStates[name] ?? false }
  setControlState (name, value) { this.controlStates[name] = value; this.calls.push(['control', name, value]) }
  stopDigging () { this.calls.push(['stopDigging']) }
}

/** Minimal ctx for calling tool handlers directly (no session). */
export function ctxFor (bot, extra = {}) {
  const signal = { aborted: false }
  return { bot, signal, checkAbort () { if (signal.aborted) throw new Error('interrupted') }, ...extra }
}
