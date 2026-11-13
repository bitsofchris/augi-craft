#!/usr/bin/env node
// Make an instance directory (docs/INSTANCE.md):
//   npm run init                      ~/.augi-craft (or $AUGI_HOME)
//   npm run init -- /path/to/instance
// Creates the knowledge folders with the starter pack of learned skills, a
// config and a crew file from the templates, and a git repository so the agents' knowledge has history. Never overwrites.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { APP_ROOT, EXAMPLE_CREW_FILE, ensureHome, homePaths } from '../runtime/home.js'
import { KnowledgeStore, ensureGitIdentity, loadConfig } from '../runtime/memory/store.js'

const arg = process.argv[2]
const env = arg ? { ...process.env, AUGI_HOME: path.resolve(arg) } : process.env
const before = homePaths(env)
const hadStarter = fs.existsSync(path.join(before.knowledgeDir, 'learned/.starter-pack.json'))
const paths = ensureHome(before)
const made = []
if (!hadStarter) {
  const starter = JSON.parse(fs.readFileSync(path.join(paths.knowledgeDir, 'learned/.starter-pack.json'), 'utf8')).copied
  if (starter.length) made.push(path.join(paths.knowledgeDir, `learned (${starter.length} starter skills and helpers)`))
}
const copy = (from, to) => { if (!fs.existsSync(to)) { fs.copyFileSync(from, to); made.push(to) } }
copy(path.join(APP_ROOT, 'templates/home/augi.config.json'), path.join(paths.home, 'augi.config.json'))
copy(EXAMPLE_CREW_FILE, path.join(paths.home, 'crew.json'))
const ignore = path.join(paths.home, '.gitignore')
if (!fs.existsSync(ignore)) { fs.writeFileSync(ignore, 'voice/\nrecordings/\nserver/\nknowledge/.augi-write.lock\nknowledge/shlock*\nknowledge/worlds/*/sightings.json\n.obsidian/\n'); made.push(ignore) }
const store = new KnowledgeStore(paths.knowledgeDir, loadConfig(path.join(paths.home, 'augi.config.json')), { appRoot: paths.appKnowledgeDir })
if (!fs.existsSync(store.p('core/MAP.md'))) { store.rebuildMap(); made.push(store.p('core/MAP.md')) }
if (!fs.existsSync(path.join(paths.home, '.git'))) {
  try {
    execFileSync('git', ['-C', paths.home, 'init', '-q'])
    ensureGitIdentity(paths.home)
    execFileSync('git', ['-C', paths.home, 'add', '--all', '.'])
    execFileSync('git', ['-C', paths.home, 'commit', '-q', '-m', 'augi-craft instance'])
    made.push(path.join(paths.home, '.git'))
  } catch { /* git missing: fine, knowledge still works without history */ }
}
console.log(`Instance: ${paths.home}${made.length ? '' : ' (already set up)'}`)
for (const m of made) console.log(`  made ${path.relative(paths.home, m) || '.'}`)
console.log(`
Next:
  1. Edit ${path.join(paths.home, 'crew.json')}: your players' names, your server's port.
  2. Set AUGI_HOME=${paths.home} in your shell if it is not the default (~/.augi-craft).
  3. Start a Minecraft server (README.md), then in Claude Code: /play make starter tools`)
