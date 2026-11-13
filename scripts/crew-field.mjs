#!/usr/bin/env node
// Print one value from the instance's crew file, for shell launchers.
//   node scripts/crew-field.mjs file                 the crew file in use
//   node scripts/crew-field.mjs roles                roles, one per line
//   node scripts/crew-field.mjs <role> username      a worker's field (player, instructions, ...)
//   node scripts/crew-field.mjs connection host      connection.host / port / auth / version
//   node scripts/crew-field.mjs model | reasoningEffort | world
import { homePaths, loadCrew } from '../runtime/home.js'

const paths = homePaths()
const crew = loadCrew(paths.crewFile)
const [a, b] = process.argv.slice(2)
let out
if (a === 'file') out = paths.crewFile
else if (a === 'home') out = paths.home
else if (a === 'roles') out = [...new Set((crew.workers ?? []).map(w => w.role))].join('\n')
else if (a === 'workers') out = (crew.workers ?? []).map(w => `${w.role} ${w.username}`).join('\n')
else if (a === 'connection') out = crew.connection?.[b]
else if (['model', 'reasoningEffort', 'world'].includes(a)) out = crew[a]
else if (a && b) {
  // A role may have several workers (agent1..agent4 share "agent"): match the
  // worker whose username or role equals the argument, case-insensitively.
  const w = (crew.workers ?? []).find(w => [w.username, w.role].some(x => String(x).toLowerCase() === a.toLowerCase()))
  out = w?.[b]
}
if (out === undefined || out === null) process.exit(1)
console.log(String(out))
