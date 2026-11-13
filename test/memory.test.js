import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { KnowledgeStore, tokenize, loadConfig } from '../runtime/memory/store.js'
import { parse, stringify } from '../runtime/memory/frontmatter.js'
import { LocationStore, recallLocation } from '../runtime/tools/locations.js'
import { convertSkill, cleanDescription, kebab } from '../scripts/import-voyager.js'
import { createAugi } from '../runtime/mcp/augi.js'
import { gameTools } from '../runtime/tools/index.js'
import { FakeBot } from './helpers/fake-bot.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Seed-only fixture so live episodes and lessons never affect test expectations. */
function tempKnowledge () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-kb-'))
  for (const part of ['core', 'seeds']) {
    fs.cpSync(path.join(repo, 'knowledge', part), path.join(dir, part), { recursive: true })
  }
  return dir
}

function fixedClock (store, start = Date.parse('2026-01-01T00:00:00Z')) {
  let t = start
  store.now = () => new Date((t += 1000))
  return store
}

test('front matter round-trips', () => {
  const text = stringify({ id: 'x', when: ['a', 'b'], stats: { successes: 1 } }, '## Body\n\ntext')
  const { data, body } = parse(text)
  assert.deepEqual(data, { id: 'x', when: ['a', 'b'], stats: { successes: 1 } })
  assert.equal(body.trim(), '## Body\n\ntext')
  assert.deepEqual(parse('no front matter').data, {})
})

test('tokenize drops stop words and plural s', () => {
  assert.deepEqual(tokenize('How do I get some Logs for planks?'), ['log', 'plank'])
})

test('seed skills have every required field', () => {
  const store = new KnowledgeStore(path.join(repo, 'knowledge'), { packs: ['basic', 'diamond-quest'], includeLearned: false })
  const skills = store.skills()
  assert.ok(skills.length >= 8)
  for (const s of skills) {
    for (const field of ['id', 'description', 'when', 'prerequisites', 'depends_on', 'implementation', 'status', 'source', 'version', 'evidence', 'failure_modes']) {
      assert.ok(s[field] !== undefined, `${s.id} missing ${field}`)
    }
    for (const dep of s.depends_on.skills ?? []) assert.ok(store.get(dep), `${s.id} depends on unknown skill ${dep}`)
  }
})

test('configurations select packs and learned skills', () => {
  const kb = path.join(repo, 'knowledge')
  const load = name => new KnowledgeStore(kb, loadConfig(path.join(repo, 'experiments/configurations', `${name}.json`)))
  assert.equal(load('empty').skills().length, 0)
  assert.ok(load('basic').skills().every(s => s.pack === 'basic'))
  assert.ok(load('rich').skills().some(s => s.pack === 'voyager-imported'))
  assert.ok(!load('rich').skills().some(s => s.pack === 'learned'))
})

test('search retrieves relevant seed skills first', () => {
  const store = new KnowledgeStore(path.join(repo, 'knowledge'), { packs: ['basic', 'diamond-quest'], includeLearned: false })
  assert.equal(store.search('collect logs from trees')[0].id, 'gather-wood')
  assert.equal(store.search('craft a wooden pickaxe')[0].id, 'acquire-starter-tools')
  assert.equal(store.search('smelt raw iron ingots')[0].id, 'acquire-and-smelt-iron')
  assert.deepEqual(store.search('the of a'), [])
})

test('episodes are written with front matter and listed newest first', () => {
  const store = fixedClock(new KnowledgeStore(tempKnowledge()))
  const a = store.writeEpisode({ task: 'Collect 4 logs', outcome: 'success', actions: ['gather_blocks log 4'], lessons: ['Trees were 5 blocks east'], inventory_delta: { oak_log: 4 } })
  const b = store.writeEpisode({ task: 'Collect 4 logs', outcome: 'failure' })
  assert.notEqual(a.id, b.id)
  const { data, body } = parse(fs.readFileSync(path.join(store.root, a.path), 'utf8'))
  assert.equal(data.outcome, 'success')
  assert.deepEqual(data.inventory_delta, { oak_log: 4 })
  assert.match(body, /## Lessons\n\n- Trees were 5 blocks east/)
  assert.equal(store.episodes()[0].id, b.id)
  assert.throws(() => store.writeEpisode({ task: 'x', outcome: 'meh' }), /outcome/)
})

test('saveSkill creates candidates, updates in place and keeps code on helper programs only', () => {
  const store = fixedClock(new KnowledgeStore(tempKnowledge()))
  const spec = {
    title: 'Starter kit from four logs',
    description: 'Exact plank budget for table, sticks, wooden pickaxe and axe from four oak logs',
    procedure: '1. gather-wood 4\n2. craft 16 planks',
    depends_on: { skills: ['gather-wood', 'acquire-starter-tools'] }
  }
  const r = store.saveSkill(spec)
  assert.equal(r.saved, true)
  assert.equal(r.status, 'candidate')
  assert.ok(fs.existsSync(path.join(store.root, 'learned/candidates/starter-kit-from-four-logs.md')))
  const again = store.saveSkill({ ...spec, id: 'starter-kit-from-four-logs', procedure: 'revised' })
  assert.equal(again.version, 2)
  assert.match(store.get('starter-kit-from-four-logs').body, /revised/)
  assert.throws(() => store.saveSkill({ ...spec, title: 'Plan with code', code: 'return 1' }), /save_helper/)
  assert.throws(() => store.saveSkill({ ...spec, title: 'Program without code', kind: 'program' }), /need code/)
})

test('saveSkill refuses to shadow seeds and flags near-duplicates', () => {
  const store = new KnowledgeStore(tempKnowledge())
  const shadow = store.saveSkill({ id: 'gather-wood', title: 'Gather wood', description: 'x', procedure: 'y' })
  assert.equal(shadow.saved, false)
  const dup = store.saveSkill({ title: 'Gather wood logs', description: 'Find the nearest trees and collect logs', procedure: 'y' })
  assert.equal(dup.saved, false)
  assert.equal(dup.similar[0].id, 'gather-wood')
  assert.equal(store.saveSkill({ title: 'Gather wood logs', description: 'Find the nearest trees and collect logs', procedure: 'y' }, { force: true }).saved, true)
})

test('promotion requires verified successes from distinct episodes', () => {
  const store = fixedClock(new KnowledgeStore(tempKnowledge(), { promotion: { minSuccesses: 2 } }))
  const ep1 = store.writeEpisode({ task: 'starter tools', outcome: 'success' })
  store.saveSkill({ title: 'Plank budget', description: 'Twelve planks cover table sticks pickaxe axe', procedure: 'p', episode: ep1.id })
  let res = store.promote('plank-budget')
  assert.equal(res.promoted, false)
  store.recordOutcome('plank-budget', { episode: ep1.id, outcome: 'success' })
  assert.equal(store.promote('plank-budget').promoted, false, 'same episode twice is not enough')
  const ep2 = store.writeEpisode({ task: 'starter tools again', outcome: 'success' })
  store.recordOutcome('plank-budget', { episode: ep2.id, outcome: 'success' })
  res = store.promote('plank-budget')
  assert.equal(res.promoted, true)
  const s = store.get('plank-budget')
  assert.equal(s.status, 'validated')
  assert.equal(s.path, path.join('learned/validated/plank-budget.md'))
  assert.equal(store.promote('gather-wood').promoted, false)
})

test('outcomes against seed skills go to a sidecar, not the seed file', () => {
  const kb = tempKnowledge()
  const store = new KnowledgeStore(kb)
  const before = fs.readFileSync(path.join(kb, 'seeds/basic/gather-wood.md'), 'utf8')
  store.recordOutcome('gather-wood', { episode: 'ep-1', outcome: 'success' })
  assert.equal(fs.readFileSync(path.join(kb, 'seeds/basic/gather-wood.md'), 'utf8'), before)
  assert.deepEqual(store.get('gather-wood').stats, { successes: 1, failures: 0 })
  store.deprecate('gather-wood', 'testing')
  assert.ok(!store.skills().some(s => s.id === 'gather-wood'))
  assert.throws(() => store.recordOutcome('nope', { outcome: 'success' }), /Unknown skill/)
})

test('deprecated learned skills move out of search', () => {
  const store = new KnowledgeStore(tempKnowledge())
  store.saveSkill({ title: 'Dig straight down', description: 'Fast descent by digging vertically', procedure: 'dig' })
  assert.equal(store.search('dig straight down')[0].id, 'dig-straight-down')
  store.deprecate('dig-straight-down', 'fell into lava')
  assert.ok(!store.search('dig straight down').some(s => s.id === 'dig-straight-down'))
  assert.ok(fs.existsSync(path.join(store.root, 'learned/deprecated/dig-straight-down.md')))
})

test('helper programs round-trip through the learned lifecycle with their code', () => {
  const store = fixedClock(new KnowledgeStore(tempKnowledge()))
  const code = 'const n = args.n ?? 1\nreturn { doubled: n * 2 }'
  const r = store.saveSkill({ title: 'Double it', description: 'Doubles a number for testing', kind: 'program', code, args: '{ n }', tags: ['shared'] })
  assert.equal(r.status, 'candidate')
  const [h] = store.programs()
  assert.equal(h.id, 'double-it')
  assert.equal(h.code, code)
  assert.match(h.implementation, /helpers\.doubleIt\(\{ n \}\)/)
  assert.equal(store.programs({ includeCode: false })[0].code, undefined)
  store.deprecate('double-it', 'superseded')
  assert.equal(store.programs().length, 0)
})

test('MAP.md generated section is rebuilt and hand-written text kept', () => {
  const store = fixedClock(new KnowledgeStore(tempKnowledge()))
  store.writeEpisode({ task: 'Collect logs', outcome: 'success' })
  store.rebuildMap()
  const map = fs.readFileSync(path.join(store.root, 'core/MAP.md'), 'utf8')
  assert.match(map, /^# Augi knowledge MAP/)
  assert.match(map, /\[gather-wood\]\(\.\.\/seeds\/basic\/gather-wood\.md\)/)
  assert.match(map, /Collect logs\]\(\.\.\/episodes\//)
  store.rebuildMap()
  assert.equal(fs.readFileSync(path.join(store.root, 'core/MAP.md'), 'utf8').match(/BEGIN GENERATED/g).length, 1)
})

test('autoCommit commits knowledge changes to git', () => {
  const kb = tempKnowledge()
  execFileSync('git', ['init', '-q', kb])
  execFileSync('git', ['-C', kb, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'])
  execFileSync('git', ['-C', kb, 'config', 'user.name', 'augi'])
  execFileSync('git', ['-C', kb, 'config', 'user.email', 'augi@example.com'])
  const store = new KnowledgeStore(kb, { autoCommit: true })
  store.writeEpisode({ task: 'commit me', outcome: 'success' })
  const log = execFileSync('git', ['-C', kb, 'log', '--oneline']).toString()
  assert.match(log, /kb: episode/)
})

test('locations persist across store instances', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'augi-loc-')), 'locations.json')
  new LocationStore(file).save('base', { x: 1.234, y: 64, z: -5 }, { note: 'chest' })
  const again = new LocationStore(file)
  assert.deepEqual(again.get('base').position, { x: 1.2, y: 64, z: -5 })
  assert.equal(recallLocation(again, { name: 'base' }).ok, true)
  assert.equal(recallLocation(again, { name: 'x' }).error.category, 'not_found')
  assert.equal(recallLocation(again, {}).observations.locations.length, 1)
})

test('programs can recall saved locations through lib.recall_location', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'augi-loc-')), 'locations.json')
  const locations = new LocationStore(file)
  locations.save('farm', { x: 10, y: 63, z: -4 })
  const tool = gameTools.find(t => t.name === 'recall_location')
  const res = await tool.handler({ bot: new FakeBot(), locations }, { name: 'farm' })
  assert.equal(res.ok, true)
  assert.deepEqual(res.observations.location.position, { x: 10, y: 63, z: -4 })
  assert.equal((await tool.handler({ bot: new FakeBot() }, { name: 'farm' })).ok, false)
})

test('voyager importer converts skills into unverified reference pack entries', () => {
  const entry = {
    code: 'async function craftWoodenPickaxe(bot) {\n  await mineWoodLog(bot);\n  await craftItem(bot, "wooden_pickaxe", 1);\n}',
    description: 'async function craftWoodenPickaxe(bot) {\n    // The function crafts a wooden pickaxe.\n    // It mines logs first.\n}'
  }
  assert.equal(kebab('craftWoodenPickaxe'), 'craft-wooden-pickaxe')
  assert.equal(cleanDescription(entry.description), 'The function crafts a wooden pickaxe. It mines logs first.')
  const { id, text } = convertSkill('craftWoodenPickaxe', entry, { allNames: ['craftWoodenPickaxe', 'mineWoodLog'] })
  const { data, body } = parse(text)
  assert.equal(id, 'voyager-craft-wooden-pickaxe')
  assert.equal(data.status, 'unverified')
  assert.deepEqual(data.depends_on, { tools: ['craft_item'], skills: ['voyager-mine-wood-log'] })
  assert.match(data.source.license, /MIT/)
  assert.match(body, /Voyager's control primitives.*save_helper/)
})

// The end-to-end memory claim: a lesson written in one MCP session is
// retrievable by a brand new server process (simulated by a new createAugi).
test('a lesson survives a CLI/MCP restart and is retrievable', async () => {
  const kb = tempKnowledge()
  const bot = new FakeBot({ blocks: { '3,64,0': 'oak_log', '3,65,0': 'oak_log', '3,66,0': 'oak_log', '3,67,0': 'oak_log' } })

  const s1 = createAugi({ knowledgeDir: kb, bot })
  const gather = await s1.tool('run_program').run({ code: "const r = await lib.gather_blocks({ block: 'log', count: 4 })\nif (!r.ok) throw new Error(r.summary)\nreturn r.summary" })
  assert.equal(gather.ok, true, JSON.stringify(gather))
  const ep = await s1.tool('kb_write_episode').run({ task: 'Collect 4 logs', outcome: 'success', inventory_delta: gather.changes.inventory, lessons: ['One gather_blocks call with alias "log" collected all 4 logs from a single oak tree'] })
  const saved = await s1.tool('kb_save_skill').run({
    title: 'Single tree log harvest',
    description: 'A single oak tree usually yields the four logs needed for starter tools; use the log alias',
    kind: 'lesson',
    when: ['starting a world with no wood'],
    depends_on: { skills: ['gather-wood'], tools: ['lib.gather_blocks'] },
    procedure: 'In a program, call lib.gather_blocks({ block: "log", count: 4 }) once near any tree.',
    episode: ep.id
  })
  assert.equal(saved.saved, true, JSON.stringify(saved))

  const s2 = createAugi({ knowledgeDir: kb, bot: new FakeBot() }) // "restart"
  const hits = await s2.tool('kb_search').run({ query: 'single tree log harvest starter tools' })
  assert.equal(hits.results[0].id, 'single-tree-log-harvest')
  const full = await s2.tool('kb_get').run({ id: 'single-tree-log-harvest' })
  assert.equal(full.skill.evidence[0].episode, ep.id)
  const recent = await s2.tool('kb_recent_episodes').run({})
  assert.equal(recent.episodes[0].task, 'Collect 4 logs')
})
