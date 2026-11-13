import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FakeBot } from './helpers/fake-bot.js'
import { createAugi, worldNameOf } from '../runtime/mcp/augi.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const kb = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-worlds-'))
  fs.cpSync(path.join(here, '..', 'knowledge', 'seeds'), path.join(dir, 'seeds'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'core'), { recursive: true })
  return dir
}

test('saved places belong to one world; a new world starts with none', async () => {
  const dir = kb()
  const second = createAugi({ knowledgeDir: dir, bot: new FakeBot(), config: { packs: ['basic'] }, world: 'second' })
  await second.tool('run_program').run({ code: "return await lib.save_location({ name: 'base_chest', x: 120, y: 64, z: -300 })" })
  assert.equal((await second.tool('recall_location').run({ name: 'base_chest' })).ok, true)
  assert.ok(fs.existsSync(path.join(dir, 'worlds', 'second', 'locations.json')))

  const test = createAugi({ knowledgeDir: dir, bot: new FakeBot(), config: { packs: ['basic'] }, world: 'token-test' })
  assert.equal((await test.tool('recall_location').run({ name: 'base_chest' })).ok, false)
  const map = await test.tool('kb_map').run({})
  assert.deepEqual([map.world.name, map.world.savedPlaces], ['token-test', 0])
})

test('world names are safe folder names, defaulting to default', () => {
  assert.equal(worldNameOf(undefined), 'default')
  assert.equal(worldNameOf('test-world_2'), 'test-world_2')
  assert.throws(() => worldNameOf('../second'), /AUGI_WORLD/)
})
