// The instance directory (AUGI_HOME): everything personal to one installation
// lives there, never in this repository. See docs/INSTANCE.md.
//
//   $AUGI_HOME/
//     augi.config.json     knowledge config (optional; defaults otherwise)
//     crew.json            your crew, players and voice settings (optional)
//     knowledge/           learned skills, helpers, episodes, worlds, MAP.md
//     voice/               certificate and saved voice orders (optional)
//     recordings/          replay files (AUGI_RECORD)
//
// Seeds and the operating protocol are read from this repo's knowledge/ when
// the instance has no copy of its own (KnowledgeStore layers the two). The
// starter pack of learned skills is copied in once (installStarterPack).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_HOME = path.join(os.homedir(), '.augi-craft')
export const EXAMPLE_CREW_FILE = path.join(APP_ROOT, 'agents/crew/crew.example.json')

export function resolveHome (env = process.env) {
  return path.resolve(env.AUGI_HOME || DEFAULT_HOME)
}

/**
 * Every path the runtime needs, derived from AUGI_HOME. The AUGI_KNOWLEDGE_DIR,
 * AUGI_CONFIG and AUGI_CREW_FILE overrides remain for tests and experiments
 * and resolve relative to the instance.
 */
export function homePaths (env = process.env) {
  const home = resolveHome(env)
  const at = (override, fallback) => override ? path.resolve(home, override) : fallback
  const ownConfig = path.join(home, 'augi.config.json')
  const ownCrew = path.join(home, 'crew.json')
  return {
    home,
    appKnowledgeDir: path.join(APP_ROOT, 'knowledge'),
    knowledgeDir: at(env.AUGI_KNOWLEDGE_DIR, path.join(home, 'knowledge')),
    configFile: at(env.AUGI_CONFIG, fs.existsSync(ownConfig) ? ownConfig : null),
    crewFile: at(env.AUGI_CREW_FILE, fs.existsSync(ownCrew) ? ownCrew : EXAMPLE_CREW_FILE),
    voiceDir: path.join(home, 'voice'),
    recordingsDir: at(env.AUGI_RECORD_DIR, path.join(home, 'recordings'))
  }
}

/** Create the instance's knowledge folders so a first run has somewhere to write. */
export function ensureHome (paths = homePaths()) {
  for (const dir of ['learned/candidates', 'learned/validated', 'learned/deprecated', 'learned/evidence', 'episodes', 'worlds']) {
    fs.mkdirSync(path.join(paths.knowledgeDir, dir), { recursive: true })
  }
  installStarterPack(paths)
  return paths
}

const STARTER_MARK = 'learned/.starter-pack.json'

/**
 * Copy the app's starter skills and helpers (knowledge/learned/validated and
 * candidates) into a new instance, once. After that the instance owns them:
 * its bots revise, promote and deprecate them like anything they learned, and
 * a skill the instance removed is not copied back. A skill the instance
 * already has (in any state) is left alone.
 * @returns {string[]} the files copied, relative to learned/
 */
export function installStarterPack (paths = homePaths()) {
  const learned = path.join(paths.knowledgeDir, 'learned')
  const mark = path.join(paths.knowledgeDir, STARTER_MARK)
  const app = path.join(paths.appKnowledgeDir, 'learned')
  if (fs.existsSync(mark) || path.resolve(learned) === path.resolve(app)) return []
  const md = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : []
  const have = new Set(['validated', 'candidates', 'deprecated'].flatMap(dir => md(path.join(learned, dir))))
  const copied = []
  for (const dir of ['validated', 'candidates']) {
    for (const f of md(path.join(app, dir))) {
      if (have.has(f)) continue
      fs.mkdirSync(path.join(learned, dir), { recursive: true })
      fs.copyFileSync(path.join(app, dir, f), path.join(learned, dir, f))
      copied.push(`${dir}/${f}`)
    }
  }
  fs.writeFileSync(mark, JSON.stringify({ installed: new Date().toISOString(), copied }, null, 2) + '\n')
  return copied
}

/** Read the crew file ({} when missing or unreadable). */
export function loadCrew (file = homePaths().crewFile) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Names that identify people at this instance (players who may give orders).
 * Skills promoted to shareable knowledge must not mention them.
 */
export function privateNames (crew = loadCrew()) {
  const names = [...(crew.voice?.players ?? []), ...(crew.people ?? []), ...(crew.workers ?? []).map(w => w.player)]
  return [...new Set(names.filter(Boolean).map(n => n.replace(/^\./, '')))]
}

/**
 * The createAugi options for this instance. The MCP server and the scripts
 * all build their store from here, so none of them can write into the repo.
 */
export function augiOptions (paths = ensureHome(homePaths()), env = process.env) {
  const crew = loadCrew(paths.crewFile)
  return {
    knowledgeDir: paths.knowledgeDir,
    appKnowledgeDir: paths.appKnowledgeDir,
    configFile: paths.configFile,
    privateNames: privateNames(crew),
    // Which world's saved places to use: AUGI_WORLD, else the crew file's world.
    world: env.AUGI_WORLD || crew.world
  }
}
