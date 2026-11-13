import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compactResult, formatResult } from '../runtime/mcp/compact.js'

test('compact results drop empty fields and unchanged positions but keep false and zero', () => {
  const r = compactResult({
    ok: false, tool: 'observe', summary: 'x', error: null,
    changes: { inventory: {}, position: { from: { x: 1, y: 64, z: 2 }, to: { x: 1, y: 64, z: 2 } } },
    observations: { logs: [], health: 0 }, events: [], woke: false
  })
  assert.deepEqual(r, { ok: false, tool: 'observe', summary: 'x', observations: { health: 0 }, woke: false })
})

test('moves and inventory changes are kept; chat times are shortened', () => {
  const r = compactResult({
    changes: { inventory: { coal: 3 }, position: { from: { x: 1, y: 64, z: 2 }, to: { x: 4, y: 60, z: 2 } } },
    inbox: [{ type: 'chat', at: '2026-10-20T22:00:50.123Z', username: '.Kid1', message: 'Agent1, get coal' }]
  })
  assert.deepEqual(r.changes.inventory, { coal: 3 })
  assert.deepEqual(r.changes.position.to, { x: 4, y: 60, z: 2 })
  assert.equal(r.inbox[0].at, '22:00:50')
})

test('formatted results are one line', () => {
  const text = formatResult({ ok: true, nested: { a: [1, 2] } })
  assert.equal(text, '{"ok":true,"nested":{"a":[1,2]}}')
})
