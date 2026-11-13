// KnowledgeStore: the Git-backed Markdown knowledge base.
//
// Layout (relative to the knowledge root):
//   core/MAP.md, core/AGENTS.md      index + operating protocol
//   seeds/<pack>/*.md                imported/seeded skills (read-only to the agent)
//   learned/candidates/*.md          agent-written skills awaiting verification
//   learned/validated/*.md           agent-written skills promoted after evidence
//   learned/deprecated/*.md          retired agent skills
//   learned/evidence/<id>.yaml       outcomes recorded against seed skills
//   (kind: program skills hold helper code that programs call as helpers.<name>)
//   episodes/*.md                    one record per attempted task
//   worlds/<world>/                  one world's state: locations.json, sightings.json, world.json
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'
import { lockMethods, atomicWrite } from './lock.js'
import { parse, slugify, stringify } from './frontmatter.js'

export const DEFAULT_CONFIG = {
  name: 'default',
  packs: ['basic', 'diamond-quest'],
  includeLearned: true,
  promotion: { minSuccesses: 2 },
  autoCommit: false,
  // Game actions programs may call as lib.*: 'all', or a list of names ([] for none).
  lib: 'all',
  // Append a line to TIMELINE.md for every helper, lesson, outcome and episode.
  timeline: false
}

const LEARNED_DIRS = { candidate: 'learned/candidates', validated: 'learned/validated', deprecated: 'learned/deprecated' }
const SKILL_KINDS = ['plan', 'lesson', 'strategy', 'program', 'tool-ref', 'code-reference']
const CODE_BLOCK = /## Code\n\n```js\n([\s\S]*?)\n```/
const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'or', 'for', 'in', 'on', 'with', 'is', 'it', 'i', 'my', 'how', 'do', 'get', 'some', 'need', 'needs', 'when'])

export function tokenize (text) {
  return String(text ?? '').toLowerCase().split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOP.has(t))
    .map(t => t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t)
}

export class KnowledgeStore {
  /**
   * @param {string} root the instance's knowledge directory (all writes go here)
   * @param {object} [config]
   * @param {object} [opts]
   * @param {string|null} [opts.appRoot] read-only fallback for core/ and seeds/
   *   (this repo's knowledge/), used when the instance has no copy of its own
   * @param {string[]} [opts.privateNames] people's names that shareable skills must not hold
   */
  constructor (root, config = {}, { appRoot = null, privateNames = [] } = {}) {
    this.root = path.resolve(root)
    this.appRoot = appRoot ? path.resolve(appRoot) : null
    this.privateNames = privateNames
    this.config = { ...DEFAULT_CONFIG, ...config, promotion: { ...DEFAULT_CONFIG.promotion, ...config.promotion } }
    this.now = () => new Date()
    lockMethods(this, this.root, ['skills', 'get', 'search', 'saveSkill', 'recordOutcome',
      'promote', 'deprecate', 'programs', 'writeEpisode', 'episodes', 'rebuildMap', 'commit'])
  }

  p (...parts) { return path.join(this.root, ...parts) }

  /** Where to read `rel` from: the instance if it has it, else the app's copy (reads only). */
  resolve (rel) {
    const own = this.p(rel)
    if (!this.appRoot || fs.existsSync(own)) return own
    const shared = path.join(this.appRoot, rel)
    return fs.existsSync(shared) ? shared : own
  }

  /** Text of a knowledge file (instance first, then the app's copy), or null. */
  readText (rel) {
    try { return fs.readFileSync(this.resolve(rel), 'utf8') } catch { return null }
  }

  _mdFiles (dir) {
    const full = this.resolve(dir)
    if (!fs.existsSync(full)) return []
    return fs.readdirSync(full).filter(f => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md').sort().map(f => path.join(dir, f))
  }

  _load (rel) {
    const { data, body } = parse(fs.readFileSync(this.resolve(rel), 'utf8'))
    return { ...data, id: data.id ?? path.basename(rel, '.md'), path: rel, body }
  }

  /** All skills visible under the active configuration (deprecated ones optional). */
  skills ({ includeDeprecated = false } = {}) {
    const out = []
    for (const pack of this.config.packs) {
      for (const rel of this._mdFiles(`seeds/${pack}`)) {
        const s = this._load(rel)
        s.pack = pack
        const ev = this._sidecar(s.id)
        if (ev) { s.evidence = ev.evidence; s.stats = ev.stats; if (ev.status) s.status = ev.status }
        out.push(s)
      }
    }
    if (this.config.includeLearned) {
      for (const [status, dir] of Object.entries(LEARNED_DIRS)) {
        if (status === 'deprecated' && !includeDeprecated) continue
        for (const rel of this._mdFiles(dir)) out.push({ ...this._load(rel), pack: 'learned' })
      }
    }
    return includeDeprecated ? out : out.filter(s => s.status !== 'deprecated')
  }

  get (id) {
    return this.skills({ includeDeprecated: true }).find(s => s.id === id) ?? null
  }

  /** Keyword retrieval, Voyager-style top-k. Validated skills rank above candidates. */
  search (query, { limit = 5 } = {}) {
    const q = [...new Set(tokenize(query))]
    if (q.length === 0) return []
    const statusBoost = { validated: 1.5, seed: 1.2, candidate: 1, unverified: 0.6 }
    return this.skills()
      .map(s => {
        const fields = [
          [`${s.id} ${s.title ?? ''}`, 3],
          [`${(s.when ?? []).join(' ')} ${(s.tags ?? []).join(' ')}`, 2],
          [s.description, 2],
          [s.body, 0.5]
        ]
        let score = 0
        for (const [text, weight] of fields) {
          const toks = new Set(tokenize(text))
          score += q.filter(t => toks.has(t)).length * weight
        }
        return { s, score: score * (statusBoost[s.status] ?? 1) }
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.id.localeCompare(b.s.id))
      .slice(0, limit)
      .map(({ s, score }) => ({ ...summarize(s), score: Math.round(score * 10) / 10 }))
  }

  // ---- learned skills -----------------------------------------------------

  _learnedPath (id) {
    for (const [status, dir] of Object.entries(LEARNED_DIRS)) {
      const rel = path.join(dir, `${id}.md`)
      if (fs.existsSync(this.p(rel))) return { rel, status }
    }
    return null
  }

  /**
   * Create or update an agent-learned plan/lesson. Refuses to shadow a seed
   * skill and refuses near-duplicates unless `force` (compose, don't duplicate).
   */
  saveSkill (spec, { force = false } = {}) {
    const id = slugify(spec.id ?? spec.title)
    if (!spec.description) throw new Error('description is required')
    const kind = spec.kind ?? 'plan'
    if (!SKILL_KINDS.includes(kind)) throw new Error(`kind must be one of ${SKILL_KINDS.join(', ')}`)
    if (kind === 'program' && !spec.code) throw new Error('program skills need code')
    if (kind !== 'program' && spec.code) throw new Error('code is only stored on helper programs; save it with save_helper')

    const existing = this._learnedPath(id)
    const seed = !existing && this.skills().find(s => s.id === id && s.pack !== 'learned')
    if (seed) {
      return { saved: false, reason: `"${id}" is a seed skill (${seed.pack}); record outcomes against it or save a new skill that depends on it`, similar: [summarize(seed)] }
    }
    if (!existing && !force) {
      const similar = this.search(`${spec.title ?? id} ${spec.description} ${(spec.when ?? []).join(' ')}`, { limit: 3 })
        .filter(s => jaccard(tokenize(`${s.title} ${s.description}`), tokenize(`${spec.title ?? id} ${spec.description}`)) >= 0.5)
      if (similar.length) {
        return { saved: false, reason: 'Similar skills already exist; extend or depend on them, or pass force=true', similar }
      }
    }

    const prev = existing ? this._load(existing.rel) : null
    const today = this.now().toISOString()
    const data = {
      id,
      title: spec.title ?? prev?.title ?? id,
      description: spec.description,
      kind,
      level: 2,
      when: spec.when ?? prev?.when ?? [],
      prerequisites: spec.prerequisites ?? prev?.prerequisites ?? [],
      depends_on: {
        tools: spec.depends_on?.tools ?? prev?.depends_on?.tools ?? [],
        skills: spec.depends_on?.skills ?? prev?.depends_on?.skills ?? []
      },
      implementation: kind === 'program'
        ? `helper program: helpers.${camel(id)}(${spec.args ?? 'args'})`
        : spec.implementation ?? prev?.implementation ?? 'plan: follow the Procedure section in a program',
      status: prev?.status ?? 'candidate',
      source: { origin: 'learned', created: prev?.source?.created ?? today, updated: today },
      version: (prev?.version ?? 0) + 1,
      evidence: prev?.evidence ?? [],
      stats: prev?.stats ?? { successes: 0, failures: 0 },
      failure_modes: spec.failure_modes ?? prev?.failure_modes ?? [],
      tags: spec.tags ?? prev?.tags ?? []
    }
    const notes = spec.notes ? `\n## Notes\n\n${spec.notes.trim()}\n` : ''
    const body = kind === 'program'
      ? `${spec.description.trim()}\n\nArgs: \`${spec.args ?? 'args'}\`\n\n## Code\n\n\`\`\`js\n${spec.code.trim()}\n\`\`\`\n${notes}`
      : spec.procedure ? `## Procedure\n\n${spec.procedure.trim()}\n${notes}` : prev?.body ?? ''
    const rel = existing?.rel ?? path.join(LEARNED_DIRS.candidate, `${id}.md`)
    this._writeFile(rel, stringify(data, body))
    const what = kind === 'program' ? (existing ? `Improved helper (v${data.version})` : 'New helper') : (existing ? `Updated ${kind}` : `New ${kind}`)
    this._timeline(what, `[[${id}|${data.title}]]: ${oneLine(spec.description)}`)
    if (spec.episode) this.recordOutcome(id, { episode: spec.episode, outcome: spec.outcome ?? 'success', note: 'created from episode' })
    this._afterWrite(`kb: ${existing ? 'update' : 'add'} skill ${id}`)
    const facts = privateFacts(`${data.title} ${spec.description} ${body}`, { names: this.privateNames })
    const warning = facts.length ? `holds instance-specific facts (${facts.map(f => f.what).join('; ')}): fine for a candidate, but it cannot be promoted until they move to world state` : undefined
    return { saved: true, id, path: rel, status: data.status, version: data.version, ...(warning ? { warning } : {}) }
  }

  /** Attach an episode outcome to any skill (seed evidence goes to a sidecar). */
  recordOutcome (id, { episode, outcome, note = '' }) {
    if (!['success', 'failure'].includes(outcome)) throw new Error('outcome must be success or failure')
    const entry = { episode: episode ?? null, outcome, note, date: this.now().toISOString() }
    const learned = this._learnedPath(id)
    let stats
    if (learned) {
      const s = this._load(learned.rel)
      const { body, path: _p, pack: _k, ...data } = s
      data.evidence = [...(data.evidence ?? []), entry]
      data.stats = bump(data.stats, outcome)
      stats = data.stats
      this._writeFile(learned.rel, stringify(data, body))
    } else {
      const skill = this.get(id)
      if (!skill) throw new Error(`Unknown skill ${id}`)
      const side = this._sidecar(id) ?? { id, evidence: [], stats: { successes: 0, failures: 0 } }
      side.evidence.push(entry)
      side.stats = bump(side.stats, outcome)
      stats = side.stats
      this._writeFile(`learned/evidence/${id}.yaml`, YAML.stringify(side))
    }
    const title = (learned ? this._load(learned.rel).title : this.get(id)?.title) ?? id
    this._timeline(outcome === 'success' ? 'Worked' : 'Failed', `[[${id}|${title}]] (${stats.successes} worked, ${stats.failures} failed)${note ? `: ${oneLine(note)}` : ''}`)
    this._afterWrite(`kb: ${outcome} evidence for ${id}`)
    return { id, stats }
  }

  /** Move a candidate to validated once it has enough verified successes. */
  promote (id) {
    const learned = this._learnedPath(id)
    if (!learned) return { promoted: false, reason: `"${id}" is not an agent-learned skill` }
    if (learned.status === 'validated') return { promoted: false, reason: 'already validated' }
    const s = this._load(learned.rel)
    const need = this.config.promotion.minSuccesses
    const successes = s.stats?.successes ?? 0
    const episodes = new Set((s.evidence ?? []).filter(e => e.outcome === 'success' && e.episode).map(e => e.episode))
    if (successes < need || episodes.size < need) {
      return { promoted: false, reason: `needs ${need} verified successes from distinct episodes (has ${successes} successes, ${episodes.size} episodes)` }
    }
    // Validated skills are shareable: they must hold in any world, for anyone.
    const facts = privateFacts(skillText(s), { names: this.privateNames })
    if (facts.length) {
      return { promoted: false, reason: `holds instance-specific facts (${facts.map(f => f.what).join('; ')}); keep the skill general and put places in world state (lib.save_location, world.json)`, facts }
    }
    const { body, path: _p, pack: _k, ...data } = s
    data.status = 'validated'
    data.source = { ...data.source, promoted: this.now().toISOString() }
    const rel = path.join(LEARNED_DIRS.validated, `${id}.md`)
    this._writeFile(rel, stringify(data, body))
    fs.rmSync(this.p(learned.rel))
    this._timeline('Validated', `[[${id}|${data.title}]] after ${successes} verified successes`)
    this._afterWrite(`kb: promote ${id}`)
    return { promoted: true, id, path: rel }
  }

  deprecate (id, reason) {
    const learned = this._learnedPath(id)
    if (learned) {
      const { body, path: _p, pack: _k, ...data } = this._load(learned.rel)
      data.status = 'deprecated'
      data.deprecated = { reason, date: this.now().toISOString() }
      this._writeFile(path.join(LEARNED_DIRS.deprecated, `${id}.md`), stringify(data, body))
      if (learned.status !== 'deprecated') fs.rmSync(this.p(learned.rel))
    } else {
      if (!this.get(id)) throw new Error(`Unknown skill ${id}`)
      const side = this._sidecar(id) ?? { id, evidence: [], stats: { successes: 0, failures: 0 } }
      side.status = 'deprecated'
      side.deprecated = { reason, date: this.now().toISOString() }
      this._writeFile(`learned/evidence/${id}.yaml`, YAML.stringify(side))
    }
    this._timeline('Dropped', `[[${id}]]: ${oneLine(reason ?? '')}`)
    this._afterWrite(`kb: deprecate ${id}`)
    return { deprecated: true, id }
  }

  /** Helper programs that are not deprecated, with their code. */
  programs ({ includeCode = true } = {}) {
    return this.skills()
      .filter(s => s.kind === 'program')
      .map(s => {
        const code = CODE_BLOCK.exec(s.body ?? '')?.[1] ?? null
        const out = { id: s.id, title: s.title, description: s.description, status: s.status, tags: s.tags ?? [], stats: s.stats ?? null, implementation: s.implementation }
        return includeCode ? { ...out, code } : out
      })
      .filter(h => !includeCode || h.code)
  }

  // ---- episodes -----------------------------------------------------------

  writeEpisode (ep) {
    if (!ep.task) throw new Error('task is required')
    if (!['success', 'failure', 'partial'].includes(ep.outcome)) throw new Error('outcome must be success, failure or partial')
    const ts = this.now().toISOString()
    let id = `${ts.slice(0, 19).replace(/[:T]/g, '-')}-${slugify(ep.task).slice(0, 40)}`
    for (let n = 2; fs.existsSync(this.p(`episodes/${id}.md`)); n++) id = id.replace(/(-v\d+)?$/, `-v${n}`)
    const data = {
      id,
      task: ep.task,
      outcome: ep.outcome,
      date: ts,
      config: this.config.name,
      skills_used: ep.skills_used ?? [],
      tools_used: ep.tools_used ?? [],
      inventory_delta: ep.inventory_delta ?? {},
      verification: ep.verification ?? '',
      attempts: ep.attempts ?? 1
    }
    const section = (title, items) => items?.length ? `## ${title}\n\n${items.map(i => `- ${i}`).join('\n')}\n\n` : ''
    const body = `${ep.summary ? `${ep.summary.trim()}\n\n` : ''}${section('Actions', ep.actions)}${section('Observations', ep.observations)}${section('Lessons', ep.lessons)}`
    const rel = `episodes/${id}.md`
    this._writeFile(rel, stringify(data, body || 'No details recorded.'))
    this._timeline(`Episode (${ep.outcome})`, `[[${id}|${oneLine(ep.task)}]]${ep.summary ? `: ${oneLine(ep.summary)}` : ''}`)
    for (const lesson of ep.lessons ?? []) this._timeline('Lesson', oneLine(lesson))
    this._afterWrite(`kb: episode ${id}`)
    return { id, path: rel }
  }

  episodes ({ limit = 10 } = {}) {
    return this._mdFiles('episodes').reverse().slice(0, limit).map(rel => {
      const e = this._load(rel)
      return { id: e.id, task: e.task, outcome: e.outcome, date: e.date, path: rel }
    })
  }

  // ---- MAP.md -------------------------------------------------------------

  rebuildMap () {
    const rel = 'core/MAP.md'
    const begin = '<!-- BEGIN GENERATED (kb_rebuild_map) -->'
    const end = '<!-- END GENERATED -->'
    const existing = this.readText(rel) ?? `# MAP\n\n${begin}\n${end}\n`
    const skills = this.skills({ includeDeprecated: true })
    const groups = {}
    for (const s of skills) (groups[s.pack] ??= []).push(s)
    const line = s => {
      const st = s.stats ? ` (${s.stats.successes ?? 0}✓/${s.stats.failures ?? 0}✗)` : ''
      return `- [${s.id}](../${s.path}) — ${s.description ?? ''} \`${s.status ?? 'seed'}\`${st}`
    }
    let gen = `${begin}\n_Config: **${this.config.name}** · packs: ${this.config.packs.join(', ') || '(none)'} · learned: ${this.config.includeLearned ? 'on' : 'off'}_\n\n`
    for (const [pack, list] of Object.entries(groups)) {
      gen += `### ${pack === 'learned' ? 'Learned (agent-written)' : `Seed pack: ${pack}`}\n\n${list.map(line).join('\n')}\n\n`
    }
    const eps = this.episodes({ limit: 10 })
    gen += `### Recent episodes\n\n${eps.length ? eps.map(e => `- [${e.task}](../${e.path}) — ${e.outcome}`).join('\n') : '- (none yet)'}\n${end}`
    const text = existing.includes(begin)
      ? existing.slice(0, existing.indexOf(begin)) + gen + existing.slice(existing.indexOf(end) + end.length)
      : `${existing.trimEnd()}\n\n${gen}\n`
    this._writeFile(rel, text)
    this._afterWrite('kb: rebuild MAP.md')
    return { path: rel, skills: skills.length, episodes: eps.length }
  }

  // ---- internals ----------------------------------------------------------

  _sidecar (id) {
    const f = this.p(`learned/evidence/${id}.yaml`)
    return fs.existsSync(f) ? YAML.parse(fs.readFileSync(f, 'utf8')) : null
  }

  _writeFile (rel, text) {
    const full = this.p(rel)
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Refusing to write outside knowledge root: ${rel}`)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    atomicWrite(full, text)
  }

  /** Append one line to TIMELINE.md (config timeline: true), under a heading per day. */
  _timeline (what, text) {
    if (!this.config.timeline) return
    const now = this.now()
    const pad = n => String(n).padStart(2, '0')
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const full = this.p('TIMELINE.md')
    let doc = (fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '# Timeline\n\nWhat the agent learned, newest last.').trimEnd()
    doc += doc.includes(`\n## ${day}\n`) ? '\n' : `\n\n## ${day}\n\n`
    this._writeFile('TIMELINE.md', `${doc}- **${pad(now.getHours())}:${pad(now.getMinutes())}** · ${what} · ${text}\n`)
  }

  _afterWrite (message) {
    if (!this.config.autoCommit) return
    try {
      ensureGitIdentity(this.root)
      execFileSync('git', ['-C', this.root, 'add', '--all', '.'], { stdio: 'ignore' })
      execFileSync('git', ['-C', this.root, 'commit', '-q', '-m', message, '--', '.'], { stdio: 'ignore' })
    } catch { /* nothing to commit or not a git repo */ }
  }

  /** Commit all pending knowledge changes (manual counterpart to autoCommit). */
  commit (message = 'kb: update knowledge') {
    ensureGitIdentity(this.root)
    execFileSync('git', ['-C', this.root, 'add', '--all', '.'])
    try {
      execFileSync('git', ['-C', this.root, 'commit', '-q', '-m', message, '--', '.'])
      return { committed: true }
    } catch {
      return { committed: false, reason: 'nothing to commit' }
    }
  }
}

/**
 * Commits need an author. A machine with no Git identity (a fresh install, CI)
 * gets a repository-local one; a configured identity is left alone.
 */
export function ensureGitIdentity (dir) {
  for (const [key, value] of [['user.name', 'augi-craft'], ['user.email', 'augi-craft@localhost']]) {
    try {
      execFileSync('git', ['-C', dir, 'config', key], { stdio: 'ignore' })
    } catch {
      try { execFileSync('git', ['-C', dir, 'config', key, value], { stdio: 'ignore' }) } catch { /* not a git repo */ }
    }
  }
}

function oneLine (text, max = 160) {
  const flat = String(text).replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function summarize (s) {
  return {
    id: s.id, title: s.title ?? s.id, description: s.description ?? '', kind: s.kind ?? 'plan',
    status: s.status ?? 'seed', pack: s.pack, when: s.when ?? [], depends_on: s.depends_on ?? {},
    stats: s.stats ?? null, path: s.path
  }
}

function camel (id) {
  return String(id).replace(/[-_]+([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function bump (stats = {}, outcome) {
  const s = { successes: stats.successes ?? 0, failures: stats.failures ?? 0 }
  if (outcome === 'success') s.successes++
  else s.failures++
  return s
}

function jaccard (a, b) {
  const A = new Set(a); const B = new Set(b)
  const inter = [...A].filter(x => B.has(x)).length
  return inter / (new Set([...A, ...B]).size || 1)
}

// Coordinates as agents write them: `120,64,-300`, `120.5, 64, -299.5`,
// `campfire131,64,-294` (no space after a word), and `x: 120, y: 64, z: -300`,
// `{x:128,y:64,z:-290}`, `x150..158,z-320..-312`, `x140 z-330` (y optional).
const NUM = '-?\\d{1,6}(?:\\.\\d+)?'
const TRIPLE = new RegExp(`(?<![\\d.])(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})(?![\\d.])`, 'g')
const RANGE = `(?:\\s*(?:\\.\\.|[-\u2013]|to)\\s*${NUM})?`
const XZ = new RegExp(`\\bx\\s*[:=]?\\s*(${NUM})${RANGE}[\\s,;]*(?:y\\s*[:=]?\\s*${NUM}${RANGE}[\\s,;]*)?z\\s*[:=]?\\s*(${NUM})`, 'gi')
const far = n => Math.abs(Number(n)) >= 100

/**
 * Instance-specific facts a shareable skill must not hold: world coordinates
 * (x and z, with or without y, one of them 100 or more), people's names, and
 * paths into someone's home directory. Small offsets such as `1, 0, 2` pass.
 * A name also matches without its trailing digits (`Kid1919` finds "kid").
 * @returns {{what: string, match: string}[]}
 */
export function privateFacts (text, { names = [] } = {}) {
  const out = []
  const t = String(text ?? '')
  for (const m of t.matchAll(TRIPLE)) {
    if (far(m[1]) || far(m[3])) out.push({ what: `world coordinates ${m[0].replace(/\s+/g, '')}`, match: m[0] })
  }
  for (const m of t.matchAll(XZ)) {
    if (far(m[1]) || far(m[2])) out.push({ what: `world coordinates ${m[0].replace(/\s+/g, '')}`, match: m[0] })
  }
  for (const m of t.matchAll(/(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s'"`)]+/g)) out.push({ what: `a home-directory path ${m[0]}`, match: m[0] })
  const lower = t.toLowerCase()
  for (const name of names) {
    if (nameForms(name).some(n => lower.includes(n))) out.push({ what: `the name ${name}`, match: name })
  }
  return out
}

/** How a name can appear in text: as written, and without trailing digits (when that leaves 5+ letters). */
export function nameForms (name) {
  const n = String(name).replace(/^\./, '').toLowerCase()
  const bare = n.replace(/\d+$/, '')
  return [...new Set([n, bare])].filter((v, i) => v.length >= (i === 0 ? 3 : 5))
}

function skillText (s) {
  const { body, path: _p, pack: _k, evidence: _e, stats: _s, source: _o, ...data } = s
  return `${JSON.stringify(data)}\n${body ?? ''}`
}

/** Load a configuration file (experiments/configurations/*.json) or defaults. */
export function loadConfig (file) {
  if (!file) return { ...DEFAULT_CONFIG }
  return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(file, 'utf8')) }
}
