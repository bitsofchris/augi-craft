import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Vec3 } from 'vec3'
import pathfinderPkg from 'mineflayer-pathfinder'
import Move from 'mineflayer-pathfinder/lib/move.js'
import { installOpenDoorNavigation, normalizeDoorPath } from '../runtime/bot/door-navigation.js'

const require = createRequire(import.meta.url)
const registry = require('minecraft-data')('26.3')
const Block = require('prismarine-block')(registry)
function fixture ({ open = true, facing = 'south', name = 'spruce_door' } = {}) {
  const bot = { registry, entities: {}, inventory: { items: () => [] }, entity: { position: new Vec3(0.5, 64, 1.5) } }
  bot.blockAt = pos => {
    const p = pos.floored()
    const door = p.x === 0 && p.z === 0 && [64, 65].includes(p.y)
    const b = door ? Block.fromProperties(registry.blocksByName[name].id, { open, facing, hinge: 'right', half: p.y === 64 ? 'lower' : 'upper', powered: false }, 0)
      : Block.fromStateId(registry.blocksByName[p.y < 64 ? 'stone' : 'air'].minStateId, 0)
    b.position = p
    return b
  }
  const movements = installOpenDoorNavigation(new pathfinderPkg.Movements(bot))
  movements.canDig = false; movements.scafoldingBlocks = []
  return { bot, movements }
}

test('real native open-door shapes allow straight walk-only path nodes through both halves', () => {
  const { bot, movements } = fixture()
  const node = new Move(0, 64, 1, 0)
  const before = bot.blockAt(new Vec3(0, 64, 0)).shapes
  const next = []
  movements.getMoveForward(node, { x: 0, z: -1 }, next)
  assert.equal(next.length, 1)
  assert.deepEqual(next[0].toBreak, [])
  assert.deepEqual(next[0].toPlace, [])
  assert.equal(next[0].z, 0)
  assert.deepEqual(bot.blockAt(new Vec3(0, 64, 0)).shapes, before)
  assert.equal(bot.blockAt(new Vec3(0, 64, 0)).boundingBox, 'block')
  assert.equal(installOpenDoorNavigation(movements), movements)
})

test('closed doors, iron doors, and crossing the open side panel stay blocked', () => {
  for (const options of [{ open: false }, { name: 'iron_door' }, { facing: 'east' }]) {
    const { movements } = fixture(options)
    const next = []
    movements.getMoveForward(new Move(0, 64, 1, 0), { x: 0, z: -1 }, next)
    assert.equal(next.length, 0)
  }
})

test('cloned walk-only settings preserve the open-door adapter and explicit avoid list', () => {
  const { movements } = fixture()
  const walking = Object.assign(Object.create(Object.getPrototypeOf(movements)), movements)
  assert.equal(walking.getBlock(new Vec3(0, 64, 1), 0, 0, -1).safe, true)
  walking.blocksToAvoid = new Set([registry.blocksByName.spruce_door.id])
  assert.equal(walking.getBlock(new Vec3(0, 64, 1), 0, 0, -1).safe, false)
})

test('post-processed doorway targets stay at floor level rather than on top of the panel', () => {
  for (const open of [true, false]) {
    const { bot } = fixture({ open })
    const node = { hash: '0,64,0', x: 0.296875, y: 65, z: 0.5, toBreak: [], toPlace: [] }
    const result = { path: [node] }
    assert.equal(normalizeDoorPath(bot, result), result)
    assert.equal(node.y, open ? 64 : 65)
    assert.equal(node.x, open ? 0.5 : 0.296875)
  }
})
