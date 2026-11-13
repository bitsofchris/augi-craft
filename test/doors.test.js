import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeBot, ctxFor } from './helpers/fake-bot.js'
import { setDoor, inspectDoor } from '../runtime/tools/doors.js'
import { gameTools } from '../runtime/tools/index.js'

const at = { x: 2, y: 64, z: 0 }
function fixture (name = 'spruce_door') {
  const bot = new FakeBot({ blocks: { '2,64,0': name } })
  const original = bot.blockAt.bind(bot)
  let open = false
  bot.blockAt = pos => ({ ...original(pos), getProperties: () => ({ open }) })
  bot.activateBlock = async () => { bot.calls.push(['activate']); open = !open }
  return bot
}

test('set_door opens once, is idempotent, and closes explicitly', async () => {
  const bot = fixture()
  bot.setControlState('sneak', true)
  const tool = gameTools.find(t => t.name === 'set_door')
  assert.equal(tool.handler, setDoor)
  assert.equal((await setDoor(ctxFor(bot), at)).observations.open, true)
  assert.equal(bot.getControlState('sneak'), true)
  assert.equal((await setDoor(ctxFor(bot), at)).ok, true)
  assert.equal(bot.calls.filter(c => c[0] === 'activate').length, 1)
  assert.equal((await setDoor(ctxFor(bot), { ...at, open: false })).observations.open, false)
  assert.equal(bot.calls.some(c => ['dig', 'goto', 'collect'].includes(c[0])), false)
})

test('set_door refuses non-doors, iron doors, hidden doors, and distant doors', async () => {
  for (const name of ['chest', 'oak_trapdoor', 'iron_door']) {
    const bot = fixture(name)
    assert.equal((await setDoor(ctxFor(bot), at)).error.category, 'invalid_argument')
    assert.equal(bot.calls.length, 0)
  }
  for (const hidden of [true, false]) {
    const bot = fixture()
    if (hidden) bot.hiddenBlocks.add('2,64,0')
    else bot.entity.position.x = 20
    assert.equal((await setDoor(ctxFor(bot), at)).error.category, 'unreachable')
    assert.equal(bot.calls.length, 0)
  }
})

test('set_door waits for observed state and reports an unacknowledged click', async () => {
  const bot = fixture()
  bot.activateBlock = async () => {}
  let ticks = 0
  bot.waitForTicks = async () => { ticks++ }
  bot.setControlState('sneak', true)
  const result = await setDoor(ctxFor(bot), at)
  assert.equal(result.error.category, 'timeout')
  assert.equal(result.observations.open, false)
  assert.equal(ticks, 20)
  assert.equal(bot.getControlState('sneak'), true)
})

test('set_door observes delayed updates and restores sneak after activation errors', async () => {
  const bot = fixture()
  const activate = bot.activateBlock
  bot.activateBlock = async () => {}
  let ticks = 0
  bot.waitForTicks = async () => { if (++ticks === 3) await activate() }
  assert.equal((await setDoor(ctxFor(bot), at)).ok, true)
  assert.equal(ticks, 3)
  bot.activateBlock = activate
  await setDoor(ctxFor(bot), { ...at, open: false })
  bot.setControlState('sneak', true)
  bot.activateBlock = async () => { throw new Error('connection lost') }
  await assert.rejects(setDoor(ctxFor(bot), at), /connection lost/)
  assert.equal(bot.getControlState('sneak'), true)
})

test('inspect_door reports actual nearby clearance and performs no interaction', async () => {
  const bot = fixture()
  const result = await inspectDoor(ctxFor(bot), at)
  assert.equal(result.observations.door.properties.open, false)
  assert.equal(result.observations.cells.length, 25)
  assert.equal(result.observations.cells.find(c => c.x === 1 && c.z === 0).feet.name, 'air')
  assert.deepEqual(bot.calls, [])
  assert.equal((await inspectDoor(ctxFor(bot), { x: 0, y: 64, z: 0 })).error.category, 'invalid_argument')
  const ctx = ctxFor(bot); ctx.signal.aborted = true
  await assert.rejects(inspectDoor(ctx, at), /interrupted/)
})
