import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadCrewNames, isBotName, humanPlayers, humansOnline } from '../runtime/bot/crew.js'

test('crew names come from crew.json workers and the voice relay', () => {
  const names = loadCrewNames()
  for (const n of ['guard', 'diamondminer', 'hunter', 'agent1', 'agent2', 'augiears']) assert.ok(names.has(n), n)
  assert.equal(names.has('.kid1'), false)
})

test('a missing crew file leaves only Augi* names as bots', () => {
  const names = loadCrewNames(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'augi-crew-')), 'none.json'))
  assert.equal(names.size, 0)
  assert.equal(isBotName('AugiDiamond', names), true)
  assert.equal(isBotName('Guard', names), false)
})

test('humans are the online players who are not crew bots or this bot', () => {
  const names = new Set(['guard', 'hunter'])
  const bot = { username: 'Agent1', players: { Agent1: { username: 'Agent1' }, Guard: { username: 'Guard' }, AugiWood: { username: 'AugiWood' }, '.Kid1': { username: '.Kid1' }, Operator: { username: 'Operator' } } }
  assert.deepEqual(humanPlayers(bot, names), ['.Kid1', 'Operator'])
  assert.equal(humansOnline(bot, names), true)
  assert.equal(humansOnline({ username: 'Agent1', players: { Guard: { username: 'Guard' } } }, names), false)
})

test('programs see the people online with humans()', async () => {
  const { FakeBot } = await import('./helpers/fake-bot.js')
  const { createAugi } = await import('../runtime/mcp/augi.js')
  const bot = new FakeBot()
  bot.players = { [bot.username]: { username: bot.username }, Hunter: { username: 'Hunter' }, '.Kid1': { username: '.Kid1' } }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-crew-kb-'))
  fs.mkdirSync(path.join(dir, 'core'), { recursive: true })
  const a = createAugi({ knowledgeDir: dir, bot, config: { packs: [] } })
  const res = await a.tool('run_program').run({ code: 'return humans()' })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.deepEqual(res.observations.returned, ['.Kid1'])
})
