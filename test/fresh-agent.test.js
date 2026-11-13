// The fresh-agent setup: an empty lib, a live TIMELINE.md, and the starter
// script that makes a new knowledge directory (docs/FRESH_AGENT.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createAugi, libTools } from '../runtime/mcp/augi.js'
import { KnowledgeStore } from '../runtime/memory/store.js'
import { gameTools } from '../runtime/tools/index.js'
import { FakeBot } from './helpers/fake-bot.js'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const emptyDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-fresh-'))
  fs.mkdirSync(path.join(dir, 'core'))
  return dir
}

test('libTools keeps every game tool by default and filters by name', () => {
  assert.equal(libTools(gameTools).length, gameTools.length)
  assert.equal(libTools(gameTools, 'all').length, gameTools.length)
  assert.deepEqual(libTools(gameTools, []), [])
  assert.deepEqual(libTools(gameTools, ['observe']).map(t => t.name), ['observe'])
  assert.throws(() => libTools(gameTools, ['not_a_tool']), /unknown tools: not_a_tool/)
  assert.throws(() => libTools(gameTools, 'none'), /must be "all" or a list/)
})

test('with lib: [] programs have no game actions but keep raw Mineflayer', async () => {
  const a = createAugi({ knowledgeDir: emptyDir(), bot: new FakeBot(), config: { packs: [], lib: [] } })
  const res = await a.tool('run_program').run({ code: 'return { lib: Object.keys(lib).filter(k => k !== "on"), y: bot.entity.position.y, goals: typeof goals.GoalNear }' })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.deepEqual(res.observations.returned, { lib: [], y: 64, goals: 'function' })
  assert.deepEqual((await a.tool('list_lib').run()).lib, [])
  assert.match(a.tool('run_program').description, /no game actions in this config/)
})

test('the default config still gives programs the full lib', async () => {
  const a = createAugi({ knowledgeDir: emptyDir(), bot: new FakeBot(), config: { packs: [] } })
  assert.equal((await a.tool('list_lib').run()).lib.length, gameTools.length)
  assert.match(a.tool('run_program').description, /tested actions/)
})

test('timeline records helpers, outcomes, promotions, episodes and lessons', () => {
  const dir = emptyDir()
  const store = new KnowledgeStore(dir, { packs: [], timeline: true })
  let t = new Date(2026, 9, 19, 10, 41).getTime()
  store.now = () => new Date((t += 60_000))
  store.saveSkill({ title: 'Chop a log', description: 'Punch the nearest log\nuntil it drops.', kind: 'program', code: 'return 1' })
  store.recordOutcome('chop-a-log', { episode: 'e1', outcome: 'failure', note: 'log was out of reach' })
  store.recordOutcome('chop-a-log', { episode: 'e1', outcome: 'success' })
  store.recordOutcome('chop-a-log', { episode: 'e2', outcome: 'success' })
  store.promote('chop-a-log')
  store.saveSkill({ title: 'Chop a log', description: 'Punch the nearest reachable log.', kind: 'program', code: 'return 2' })
  store.writeEpisode({ task: 'get wood', outcome: 'success', summary: 'Got 4 logs.', lessons: ['Leaves block the path; dig through them'] })
  const lines = fs.readFileSync(path.join(dir, 'TIMELINE.md'), 'utf8').split('\n')
  assert.equal(lines[0], '# Timeline')
  assert.ok(lines.includes('## 2026-10-19'))
  const entries = lines.filter(l => l.startsWith('- '))
  assert.deepEqual(entries.map(l => l.split(' · ')[1]), ['New helper', 'Failed', 'Worked', 'Worked', 'Validated', 'Improved helper (v2)', 'Episode (success)', 'Lesson'])
  assert.match(entries[0], /^- \*\*10:4\d\*\* · New helper · \[\[chop-a-log\|Chop a log\]\]: Punch the nearest log until it drops\.$/)
  assert.match(entries[1], /\(0 worked, 1 failed\): log was out of reach$/)
  assert.match(entries[6], /^- \*\*1\d:\d\d\*\* · Episode \(success\) · \[\[\d{4}-.*get-wood\|get wood\]\]: Got 4 logs\.$/)
  assert.equal(entries[7].split(' · ')[2], 'Leaves block the path; dig through them')
})

test('timeline starts a new heading each day and is off by default', () => {
  const dir = emptyDir()
  const store = new KnowledgeStore(dir, { packs: [], timeline: true })
  store.now = () => new Date(2026, 9, 19, 23, 59)
  store.saveSkill({ title: 'Plan one', description: 'First plan', kind: 'plan' })
  store.now = () => new Date(2026, 9, 20, 0, 1)
  store.saveSkill({ title: 'Plan two', description: 'Another strategy entirely', kind: 'strategy' })
  const text = fs.readFileSync(path.join(dir, 'TIMELINE.md'), 'utf8')
  assert.match(text, /## 2026-10-19\n\n- \*\*23:59\*\* · New plan[^\n]*\n\n## 2026-10-20\n\n- \*\*00:01\*\* · New strategy/)

  const quiet = emptyDir()
  new KnowledgeStore(quiet, { packs: [] }).saveSkill({ title: 'Plan', description: 'A plan', kind: 'plan' })
  assert.equal(fs.existsSync(path.join(quiet, 'TIMELINE.md')), false)
})

test('fresh-kb.sh makes a git-backed instance with an empty-lib config', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'augi-freshkb-')), 'kb')
  const out = execFileSync('bash', [path.join(repo, 'scripts/fresh-kb.sh'), dir, 'AugiTest'], { encoding: 'utf8' })
  assert.match(out, /AugiTest/)
  // The printed launch command keeps the agent to its own MCP tools: no
  // built-in tools, augi-craft allowed without prompts, prompt before the
  // variadic flags so they do not swallow it.
  const launch = out.split('\n').find(l => l.includes('claude '))
  assert.ok(launch.includes(`cd "${dir}" && claude "/play get me a diamond" --tools "" --allowedTools "mcp__augi-craft" --strict-mcp-config --mcp-config mcp.json`), launch)
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'augi.config.json'), 'utf8'))
  assert.deepEqual({ packs: config.packs, lib: config.lib, timeline: config.timeline, autoCommit: config.autoCommit }, { packs: [], lib: [], timeline: true, autoCommit: true })
  const protocol = fs.readFileSync(path.join(dir, 'knowledge/core/AGENTS.md'), 'utf8')
  assert.match(protocol, /save_helper/)
  assert.doesNotMatch(protocol, /mineForDiamonds|obtain_item|helpers\.huntNearby/)
  assert.ok(fs.existsSync(path.join(dir, 'knowledge/TIMELINE.md')))
  assert.match(fs.readFileSync(path.join(dir, 'knowledge/core/MAP.md'), 'utf8'), /BEGIN GENERATED/)
  const mcp = JSON.parse(fs.readFileSync(path.join(dir, 'mcp.json'), 'utf8'))
  assert.equal(mcp.mcpServers['augi-craft'].env.MC_USERNAME, 'AugiTest')
  assert.equal(mcp.mcpServers['augi-craft'].env.AUGI_HOME, dir)
  assert.equal(mcp.mcpServers['augi-craft'].env.AUGI_KNOWLEDGE_DIR, undefined)
  assert.match(execFileSync('git', ['-C', dir, 'log', '--oneline'], { encoding: 'utf8' }), /fresh knowledge base/)
  // Refuses to reuse a directory that already exists.
  assert.throws(() => execFileSync('bash', [path.join(repo, 'scripts/fresh-kb.sh'), dir, 'AugiTest'], { stdio: 'pipe' }))
})
