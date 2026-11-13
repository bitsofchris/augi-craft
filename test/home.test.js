import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { APP_ROOT, EXAMPLE_CREW_FILE, augiOptions, ensureHome, homePaths, installStarterPack, loadCrew, privateNames, resolveHome } from '../runtime/home.js'
import { KnowledgeStore, nameForms, privateFacts } from '../runtime/memory/store.js'
import { createAugi } from '../runtime/mcp/augi.js'
import { FakeBot } from './helpers/fake-bot.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'augi-home-test-'))
const appKnowledge = path.join(APP_ROOT, 'knowledge')

test('AUGI_HOME names the instance; every personal path hangs off it', () => {
  const home = tmp()
  const p = homePaths({ AUGI_HOME: home })
  assert.equal(p.home, home)
  assert.equal(p.knowledgeDir, path.join(home, 'knowledge'))
  assert.equal(p.voiceDir, path.join(home, 'voice'))
  assert.equal(p.recordingsDir, path.join(home, 'recordings'))
  assert.equal(p.appKnowledgeDir, appKnowledge)
  assert.equal(p.configFile, null, 'no config file until the instance has one')
  assert.equal(p.crewFile, EXAMPLE_CREW_FILE, 'the example crew stands in until the instance has one')
  assert.equal(resolveHome({}), path.join(os.homedir(), '.augi-craft'))

  fs.writeFileSync(path.join(home, 'augi.config.json'), '{"name":"mine"}')
  fs.writeFileSync(path.join(home, 'crew.json'), '{"workers":[]}')
  const q = homePaths({ AUGI_HOME: home })
  assert.equal(q.configFile, path.join(home, 'augi.config.json'))
  assert.equal(q.crewFile, path.join(home, 'crew.json'))
  // Overrides resolve relative to the instance.
  const r = homePaths({ AUGI_HOME: home, AUGI_KNOWLEDGE_DIR: 'kb2', AUGI_RECORD_DIR: '/abs/rec' })
  assert.equal(r.knowledgeDir, path.join(home, 'kb2'))
  assert.equal(r.recordingsDir, path.resolve('/abs/rec'))
})

test('augiOptions points the store at the instance, never at the repo', () => {
  const home = tmp()
  fs.writeFileSync(path.join(home, 'crew.json'), '{"world":"other","people":[".Player9"]}')
  const o = augiOptions(ensureHome(homePaths({ AUGI_HOME: home })), {})
  assert.equal(o.knowledgeDir, path.join(home, 'knowledge'))
  assert.equal(o.appKnowledgeDir, appKnowledge)
  assert.equal(o.configFile, null, 'a missing config file is null, not a path that cannot be read')
  assert.equal(o.world, 'other')
  assert.deepEqual(o.privateNames, ['Player9'])
  assert.equal(augiOptions(ensureHome(homePaths({ AUGI_HOME: home })), { AUGI_WORLD: 'test' }).world, 'test')
  // the scripts that build a store go through it too
  for (const script of ['scripts/demo-starter-tools.js', 'scripts/kb-tool.js', 'runtime/mcp/server.js']) {
    const src = fs.readFileSync(path.join(APP_ROOT, script), 'utf8')
    assert.match(src, /createAugi\(\{? ?(\.\.\.)?augiOptions\(/, `${script} builds its store from augiOptions()`)
  }
})

test('a new instance reads seeds and the protocol from the app and writes only to itself', async () => {
  const home = tmp()
  const p = ensureHome(homePaths({ AUGI_HOME: home }))
  assert.ok(fs.existsSync(path.join(p.knowledgeDir, 'episodes')))
  // other test files read the app tree and hold its transient lock while they do
  const snapshot = () => fs.readdirSync(appKnowledge, { recursive: true }).filter(f => !/(^|\/)(\.augi-write\.lock|shlock)/.test(f)).sort().join('\n')
  const before = snapshot()
  const augi = createAugi({ knowledgeDir: p.knowledgeDir, appKnowledgeDir: p.appKnowledgeDir, bot: new FakeBot(), config: { packs: ['basic'] } })
  const skills = augi.store.skills()
  assert.ok(skills.some(s => s.id === 'gather-wood'), 'seed skills come from the app')
  const map = await augi.tool('kb_map').run({})
  assert.ok(map.protocol.includes('#'), 'the protocol is read from the app')
  assert.match(map.map, /gather-wood/, 'MAP.md is built on first use')
  assert.ok(fs.existsSync(path.join(p.knowledgeDir, 'core/MAP.md')), 'into the instance')
  assert.equal(fs.existsSync(path.join(p.knowledgeDir, 'seeds')), false, 'seeds are not copied')
  assert.equal(map.world.name, 'default')

  augi.store.saveSkill({ id: 'my-lesson', description: 'Torches stop spawns', kind: 'lesson', procedure: 'Light it up.' })
  assert.ok(fs.existsSync(path.join(p.knowledgeDir, 'learned/candidates/my-lesson.md')))
  await augi.tool('kb_write_episode').run({ task: 'Collect logs', outcome: 'success' })
  assert.equal(snapshot(), before, 'the app tree is untouched')
  assert.ok(fs.readdirSync(path.join(p.knowledgeDir, 'episodes')).length === 1, 'episodes land in the instance')
})

test('an instance copy of core/ or seeds/ wins over the app copy', () => {
  const home = tmp()
  const p = ensureHome(homePaths({ AUGI_HOME: home }))
  fs.mkdirSync(path.join(p.knowledgeDir, 'core'), { recursive: true })
  fs.writeFileSync(path.join(p.knowledgeDir, 'core/AGENTS.md'), '# my own protocol\n')
  const store = new KnowledgeStore(p.knowledgeDir, { packs: ['basic'] }, { appRoot: p.appKnowledgeDir })
  assert.equal(store.readText('core/AGENTS.md'), '# my own protocol\n')
  assert.ok(store.skills().length > 0, 'seeds still come from the app')
})

test('privateFacts finds world coordinates, people and home paths; small offsets pass', () => {
  assert.deepEqual(privateFacts('go to 1, 0, 2 then y 64').map(f => f.what), [])
  assert.deepEqual(privateFacts('chest at 120,64,-300').map(f => f.what), ['world coordinates 120,64,-300'])
  assert.deepEqual(privateFacts('deliver to Kid1', { names: ['.Kid1'] }).map(f => f.what), ['the name .Kid1'])
  // Built at runtime so this test file itself passes the publish check.
  const mac = ['', 'Users', 'someone', 'repos', 'x'].join('/')
  assert.deepEqual(privateFacts(`see ${mac}`).map(f => f.match), [mac])
  assert.equal(privateFacts(['C:', 'Users', 'someone', 'x'].join('\\')).length, 1)
})

test('kb_promote refuses a skill that holds instance-specific facts; saving warns', () => {
  const home = tmp()
  const p = ensureHome(homePaths({ AUGI_HOME: home }))
  const store = new KnowledgeStore(p.knowledgeDir, { packs: [], promotion: { minSuccesses: 1 } }, { appRoot: p.appKnowledgeDir, privateNames: ['Kid1'] })
  const saved = store.saveSkill({ id: 'bring-kid1-ore', description: 'Bring ore to Kid1 at the chest 120,64,-300', procedure: 'walk there' })
  assert.equal(saved.saved, true)
  assert.match(saved.warning, /instance-specific/)
  store.recordOutcome('bring-kid1-ore', { episode: 'ep-1', outcome: 'success' })
  const res = store.promote('bring-kid1-ore')
  assert.equal(res.promoted, false)
  assert.match(res.reason, /world coordinates 120,64,-300/)
  assert.match(res.reason, /the name Kid1/)

  const ok = store.saveSkill({ id: 'light-tunnels', description: 'Place a torch every 8 blocks', procedure: 'count steps' })
  assert.equal(ok.warning, undefined)
  store.recordOutcome('light-tunnels', { episode: 'ep-2', outcome: 'success' })
  assert.equal(store.promote('light-tunnels').promoted, true)
})

test('privateFacts catches the coordinate forms agents write, and names without their digits', () => {
  for (const text of ['campfire131,64,-294', 'near150,72,-310', '{x:128,y:64,z:-290}', 'x: 120, y: 64, z: -300', '120.5,64,-299.5', 'x150..158,z-320..-312', 'near x140 z-330']) {
    assert.equal(privateFacts(text).length, 1, text)
  }
  for (const text of ['await lib.navigate_to({x:p.x,y:64,z:p.z,range:1})', 'for(let x=10;x<=14;x++)', 'faces=[[0,-1,0],[1,0,0]]', 'time 9000, 3 kills, 16 logs']) {
    assert.deepEqual(privateFacts(text), [], text)
  }
  assert.deepEqual(nameForms('.Builder1919'), ['builder1919', 'builder'])
  assert.deepEqual(nameForms('Kid1'), ['kid1'], 'a short stem is not a name on its own')
  assert.equal(privateFacts('say hi to Builder', { names: ['.Builder1919'] }).length, 1)
})

const starterFiles = () => ['validated', 'candidates'].flatMap(dir => {
  const full = path.join(appKnowledge, 'learned', dir)
  return fs.existsSync(full) ? fs.readdirSync(full).filter(f => f.endsWith('.md')).map(f => path.join(full, f)) : []
})

test('the starter pack (skills and helpers) holds no instance-specific facts', () => {
  assert.ok(starterFiles().length > 5)
  for (const file of starterFiles()) {
    const text = fs.readFileSync(file, 'utf8')
    const facts = privateFacts(text)
    assert.deepEqual(facts, [], `${path.basename(file)}: ${facts.map(x => x.what).join('; ')}`)
    // Episode ids keep only their date and time: the rest is built from an order's text.
    for (const m of text.matchAll(/episode: "?([^"\n]+)/g)) assert.match(m[1], /^\d{4}(-\d\d){5}$/, `${path.basename(file)}: evidence ${m[1]}`)
  }
})

test('a new instance gets the starter pack once, and then owns it', () => {
  const home = tmp()
  const p = ensureHome(homePaths({ AUGI_HOME: home }))
  const store = new KnowledgeStore(p.knowledgeDir, { packs: [] }, { appRoot: p.appKnowledgeDir })
  const ids = store.skills().map(s => s.id)
  for (const file of starterFiles()) assert.ok(ids.includes(path.basename(file, '.md')), path.basename(file))
  assert.ok(store.programs().some(h => h.id === 'mine-for-diamonds' && h.code), 'starter helpers load with their code')

  // The instance may drop one; a later start must not bring it back.
  fs.rmSync(path.join(p.knowledgeDir, 'learned/validated/hunt-nearby.md'))
  ensureHome(p)
  assert.equal(fs.existsSync(path.join(p.knowledgeDir, 'learned/validated/hunt-nearby.md')), false)
  assert.deepEqual(installStarterPack(p), [])

  // An instance that already has a skill keeps its own copy.
  const other = homePaths({ AUGI_HOME: tmp() })
  fs.mkdirSync(path.join(other.knowledgeDir, 'learned/candidates'), { recursive: true })
  fs.writeFileSync(path.join(other.knowledgeDir, 'learned/candidates/hunt-nearby.md'), 'mine\n')
  ensureHome(other)
  assert.equal(fs.readFileSync(path.join(other.knowledgeDir, 'learned/candidates/hunt-nearby.md'), 'utf8'), 'mine\n')
  assert.equal(fs.existsSync(path.join(other.knowledgeDir, 'learned/validated/hunt-nearby.md')), false)
})

test('every helper the protocol and role files name ships in the starter pack', () => {
  const shipped = new Set(starterFiles().flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(/^implementation: .*helpers\.(\w+)/gm)].map(m => m[1])))
  const docs = [path.join(appKnowledge, 'core/AGENTS.md'), ...fs.readdirSync(path.join(APP_ROOT, 'agents/crew')).filter(f => f.endsWith('.md')).map(f => path.join(APP_ROOT, 'agents/crew', f))]
  for (const doc of docs) {
    for (const m of fs.readFileSync(doc, 'utf8').matchAll(/helpers\.(\w+)/g)) assert.ok(shipped.has(m[1]), `${path.relative(APP_ROOT, doc)} names helpers.${m[1]}, which is not shipped`)
  }
})

test('private names come from the crew file: voice players, people and workers\' players', () => {
  assert.deepEqual(privateNames({ voice: { players: ['.Kid1', 'Op'] }, people: ['Kid1'], workers: [{ player: 'Kid2' }, {}] }), ['Kid1', 'Op', 'Kid2'])
  assert.deepEqual(privateNames(loadCrew('/nonexistent/crew.json')), [])
  assert.ok(privateNames(loadCrew(EXAMPLE_CREW_FILE)).includes('Player1'))
})

test('knowledge commits work on a machine with no Git identity', () => {
  const home = tmp()
  const p = ensureHome(homePaths({ AUGI_HOME: home }))
  execFileSync('git', ['-C', p.knowledgeDir, 'init', '-q'])
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', HOME: home }
  const store = new KnowledgeStore(p.knowledgeDir, { packs: [], autoCommit: true })
  // Run the commit the way a fresh machine would: no global identity at all.
  const code = `import('${new URL('../runtime/memory/store.js', import.meta.url).href}').then(m => { const s = new m.KnowledgeStore(process.argv[1], { packs: [] }); s.saveSkill({ id: 'a-lesson', description: 'd', procedure: 'p' }); console.log(JSON.stringify(s.commit('kb: test'))) })`
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code, p.knowledgeDir], { env, encoding: 'utf8' })
  assert.deepEqual(JSON.parse(out.trim()), { committed: true })
  assert.match(execFileSync('git', ['-C', p.knowledgeDir, 'log', '-1', '--format=%an'], { encoding: 'utf8', env }).trim(), /./)
  void store
})
