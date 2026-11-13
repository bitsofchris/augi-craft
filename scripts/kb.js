#!/usr/bin/env node
// Tiny CLI over the knowledge base (no Minecraft needed).
//   npm run kb -- search "starter tools"
//   npm run kb -- get gather-wood
//   npm run kb -- episodes
//   npm run kb -- map            (rebuild MAP.md)
//   npm run kb -- promote <id>
import { KnowledgeStore, loadConfig } from '../runtime/memory/store.js'
import { homePaths, loadCrew, privateNames } from '../runtime/home.js'

// Works on the instance's knowledge ($AUGI_HOME/knowledge), reading seeds from this repo.
const paths = homePaths()
const store = new KnowledgeStore(paths.knowledgeDir, loadConfig(paths.configFile), { appRoot: paths.appKnowledgeDir, privateNames: privateNames(loadCrew(paths.crewFile)) })
const [cmd, ...rest] = process.argv.slice(2)
const arg = rest.join(' ')

const commands = {
  search: () => store.search(arg, { limit: 8 }).forEach(s => console.log(`${s.score.toString().padStart(5)}  ${s.id} [${s.pack}/${s.status}] — ${s.description}`)),
  get: () => { const s = store.get(arg); console.log(s ? JSON.stringify(s, null, 2) : `No skill ${arg}`) },
  episodes: () => store.episodes({ limit: 20 }).forEach(e => console.log(`${e.date}  ${e.outcome.padEnd(8)} ${e.task}  (${e.path})`)),
  map: () => console.log(store.rebuildMap()),
  promote: () => console.log(store.promote(arg)),
  skills: () => store.skills().forEach(s => console.log(`${s.id} [${s.pack}/${s.status}]`))
}

if (!commands[cmd]) {
  console.error(`Usage: npm run kb -- <${Object.keys(commands).join('|')}> [args]`)
  process.exit(1)
}
commands[cmd]()
