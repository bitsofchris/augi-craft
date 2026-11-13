// Wires the bot session, the program loop and the knowledge store into one
// flat tool list. Kept separate from the stdio server so tests can drive it.
//
// Game control goes through run_program: agents write programs that call
// `lib` (the tested actions in runtime/tools) and saved helpers. Only a few
// direct tools remain for quick reads, chat and stopping.
import path from 'node:path'
import { z } from 'zod'
import { withKnowledgeLock } from '../memory/lock.js'
import { BotSession } from '../bot/session.js'
import { connectBot, connectionOptionsFromEnv } from '../bot/connect.js'
import { gameTools } from '../tools/index.js'
import { createLib } from '../program/lib.js'
import { createProgramTools } from '../program/tools.js'
import { LocationStore, recallLocation } from '../tools/locations.js'
import { SightingStore } from '../tools/sightings.js'
import { isBotName } from '../bot/crew.js'
import { KnowledgeStore, loadConfig } from '../memory/store.js'

/**
 * @param {object} opts
 * @param {string} opts.knowledgeDir
 * @param {string|null} [opts.configFile]
 * @param {object} [opts.config] overrides configFile
 * @param {object} [opts.bot] pre-made bot (tests)
 * @param {() => Promise<object>} [opts.connect]
 * @param {string} [opts.world] which world's state to use (default AUGI_WORLD, else 'default')
 * @param {string|null} [opts.appKnowledgeDir] read-only fallback for core/ and seeds/ (runtime/home.js)
 * @param {string[]} [opts.privateNames] people's names shareable skills must not hold
 */
export function createAugi ({ knowledgeDir, configFile = null, config = null, bot = null, connect = null, world = process.env.AUGI_WORLD, appKnowledgeDir = null, privateNames = [] }) {
  const store = new KnowledgeStore(knowledgeDir, config ?? loadConfig(configFile), { appRoot: appKnowledgeDir, privateNames })
  // Skills and lessons are shared; saved places, sightings and notes belong to
  // one world (knowledge/worlds/<world>/), so a new world starts with none.
  const worldName = worldNameOf(world)
  const worldDir = path.join(knowledgeDir, 'worlds', worldName)
  const locations = new LocationStore(path.join(worldDir, 'locations.json'))
  const sightings = new SightingStore(path.join(worldDir, 'sightings.json'))
  const session = new BotSession({
    bot,
    locations,
    sightings,
    defensePolicy: defensePolicyFromEnv(store.config.selfDefense ?? null),
    connect: connect ?? (() => connectBot(connectionOptionsFromEnv()))
  })

  // Replay markers (runtime/recording): orders, finished jobs and deaths show
  // up on the replay timeline when the bot is being recorded.
  const marker = (name) => {
    const bot = session.bot
    return bot?.augiRecorder?.addMarker(name, bot.entity?.position) ?? false
  }
  const note = session.note.bind(session)
  session.note = (type, data = {}) => {
    note(type, data)
    // Players' orders, not the crew's own chatter (hellos, acknowledgements).
    if (type === 'chat' && !isBotName(data.username)) marker(`${data.username}: ${data.message}`)
    else if (type === 'job_finished') marker(`${data.ok ? 'job done' : 'job ended'}: ${data.summary ?? data.jobId}`)
    else if (type === 'death') marker(`died${data.cause ? ': ' + data.cause : ''}`)
  }

  const kb = (fn) => async (args) => {
    try {
      return { ok: true, ...(await fn(args)) }
    } catch (err) {
      return { ok: false, error: { category: 'invalid_argument', message: err.message } }
    }
  }

  const lib = createLib(libTools(gameTools, store.config.lib))
  const direct = new Set(['observe', 'say'])
  const tools = [
    ...gameTools.filter(t => direct.has(t.name)).map(t => ({
      name: t.name,
      description: t.description,
      input: t.input,
      run: (args) => session.run(t.name, ctx => t.handler(ctx, args), { timeoutMs: t.timeoutMs, exclusive: t.exclusive ?? true })
    })),
    ...createProgramTools({ session, store, lib }),
    {
      name: 'stop_action',
      description: 'Stop the running program or action (also stops background jobs, pathfinding, digging, open windows).',
      input: {},
      run: async () => ({ ok: true, ...session.stop('stop_action called') })
    },
    {
      name: 'bot_status',
      description: 'Connection status, Minecraft version, and the currently running action (does not connect).',
      input: {},
      run: async () => ({
        ok: true,
        connected: Boolean(session.bot),
        username: session.bot?.username ?? null,
        version: session.bot?.version ?? null,
        running: session.current ? { tool: session.current.tool, forMs: Date.now() - session.current.startedAt } : null,
        task: session.task ?? null,
        pendingEvents: session.inbox.length,
        selfDefense: session.defenseState,
        server: connectionOptionsFromEnv()
      })
    },
    {
      name: 'set_task',
      description: 'Remember the order you are working on (who asked, what, where, job id) so it survives context compaction; wait_for_chat and bot_status show it back. Call it when you accept an order and when it changes; an empty task clears it.',
      input: { task: z.string().max(400) },
      run: async ({ task }) => {
        session.task = task.trim() ? { text: task.trim(), since: new Date().toISOString() } : null
        if (session.task) marker(`task: ${session.task.text}`)
        return { ok: true, task: session.task }
      }
    },
    {
      name: 'mark_moment',
      description: 'Put a named marker on the replay timeline at this moment ("roof finished", "found a huge cave"), so a person filming later can jump to it. Only works while the bot is being recorded (AUGI_RECORD).',
      input: { name: z.string().min(1).max(120) },
      run: async ({ name }) => marker(name)
        ? { ok: true, marked: name }
        : { ok: false, error: { category: 'not_found', message: 'not recording (start the bot with AUGI_RECORD=1)' } }
    },
    {
      name: 'read_chat',
      description: 'Read recent in-game chat from players (instructions can be given in chat). clear=true empties the buffer.',
      input: { clear: z.boolean().optional() },
      run: async ({ clear }) => {
        const messages = [...session.chatLog]
        if (clear) session.chatLog.length = 0
        return { ok: true, messages }
      }
    },
    {
      name: 'wait_for_chat',
      description: 'Wait for orders or for your background job, in one long call (default 240 s): returns as soon as a player chats (or, with names, a message mentions one of them), a background job finishes (job_finished), or the bot dies or is kicked. Returns all pending events and your current task (set_task). Call it again whenever you have nothing to do; while a background job runs, call this instead of polling job_status.',
      input: {
        seconds: z.number().int().min(1).max(280).optional().describe('Default 240'),
        names: z.array(z.string()).optional().describe('Only wake for chat mentioning one of these (case-insensitive), e.g. your name, role, "everyone"')
      },
      run: async ({ seconds = 240, names }) => {
        // Chat only arrives while connected, so join the server before listening.
        try { await session.getBot() } catch (err) { return { ok: false, error: { category: 'not_connected', message: err.message } } }
        const wanted = names?.map(n => n.toLowerCase())
        const wakes = e => e.type !== 'chat' ? ['job_finished', 'death', 'kicked'].includes(e.type)
          : !wanted?.length || wanted.some(n => e.message.toLowerCase().includes(n))
        const deadline = Date.now() + seconds * 1000
        // If the client gave up on this call (tool timeout) it has moved on and
        // made a newer call: stop, and leave the events for that one.
        const mine = session.callSeq
        while (Date.now() < deadline && !session.inbox.some(wakes) && session.callSeq === mine) await new Promise(resolve => setTimeout(resolve, 200))
        if (session.callSeq !== mine) return { ok: true, woke: false, superseded: true }
        const events = session.drainInbox()
        return { ok: true, woke: events.some(wakes), events, task: session.task ?? null }
      }
    },
    {
      name: 'recall_location',
      description: 'Look up a saved location by name, or list all saved locations.',
      input: { name: z.string().optional() },
      run: async (args) => recallLocation(locations, args)
    },

    // ---- knowledge base ------------------------------------------------
    {
      name: 'kb_map',
      description: 'Read core/MAP.md (index of skills, packs, recent episodes), core/AGENTS.md (operating protocol) and which world you are in (its notes and how many places are saved there). Call at the start of a session.',
      input: {},
      run: kb(async () => {
        const fs = await import('node:fs')
        const notes = store.readText(path.join('worlds', worldName, 'world.json'))
        const world = { name: worldName, notes: notes ? JSON.parse(notes) : null, savedPlaces: locations.list().length }
        // A new instance has no MAP.md yet: build it from the seeds.
        if (!fs.existsSync(store.p('core/MAP.md'))) store.rebuildMap()
        return { config: store.config, world, ...withKnowledgeLock(knowledgeDir, () => ({ map: store.readText('core/MAP.md'), protocol: store.readText('core/AGENTS.md') })) }
      })
    },
    {
      name: 'kb_search',
      description: 'Retrieve the most relevant skills (plans, lessons, strategies) for a task before acting. Returns summaries; use kb_get for full text.',
      input: { query: z.string(), limit: z.number().int().min(1).max(20).optional() },
      run: kb(async ({ query, limit }) => ({ results: store.search(query, { limit: limit ?? 5 }) }))
    },
    {
      name: 'kb_get',
      description: 'Read one skill in full (front matter, procedure, evidence, failure modes).',
      input: { id: z.string() },
      run: kb(async ({ id }) => {
        const s = store.get(id)
        if (!s) throw new Error(`No skill "${id}"`)
        return { skill: s }
      })
    },
    {
      name: 'kb_save_skill',
      description: 'Create or update an agent-learned Markdown skill (plan, lesson, strategy). New skills start as candidates. Prefer composing existing skills via depends_on.skills over duplicating them. Save reusable code with save_helper instead.',
      input: {
        id: z.string().optional(),
        title: z.string(),
        description: z.string(),
        kind: z.enum(['plan', 'lesson', 'strategy']).optional(),
        when: z.array(z.string()).optional(),
        prerequisites: z.array(z.string()).optional(),
        depends_on: z.object({ tools: z.array(z.string()).optional(), skills: z.array(z.string()).optional() }).optional(),
        procedure: z.string().describe('Markdown steps that reference tools/skills'),
        notes: z.string().optional(),
        failure_modes: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        episode: z.string().optional().describe('Episode id that supports this skill'),
        outcome: z.enum(['success', 'failure']).optional(),
        force: z.boolean().optional().describe('Save even if similar skills exist')
      },
      run: kb(async ({ force, ...spec }) => store.saveSkill(spec, { force }))
    },
    {
      name: 'kb_record_outcome',
      description: 'Attach a verified episode outcome (success/failure) to a skill that was used.',
      input: { id: z.string(), episode: z.string(), outcome: z.enum(['success', 'failure']), note: z.string().optional() },
      run: kb(async ({ id, ...rest }) => store.recordOutcome(id, rest))
    },
    {
      name: 'kb_promote',
      description: 'Promote a candidate learned skill to validated. Requires the configured number of successes from distinct episodes.',
      input: { id: z.string() },
      run: kb(async ({ id }) => store.promote(id))
    },
    {
      name: 'kb_deprecate',
      description: 'Retire a skill that proved wrong or was superseded.',
      input: { id: z.string(), reason: z.string() },
      run: kb(async ({ id, reason }) => store.deprecate(id, reason))
    },
    {
      name: 'kb_write_episode',
      description: 'Record an attempted task: actions, verified inventory delta, outcome, observations and lessons. Returns the episode id to cite as evidence.',
      input: {
        task: z.string(),
        outcome: z.enum(['success', 'failure', 'partial']),
        summary: z.string().optional(),
        actions: z.array(z.string()).optional(),
        observations: z.array(z.string()).optional(),
        lessons: z.array(z.string()).optional(),
        skills_used: z.array(z.string()).optional(),
        tools_used: z.array(z.string()).optional(),
        inventory_delta: z.record(z.number()).optional(),
        verification: z.string().optional(),
        attempts: z.number().int().optional()
      },
      run: kb(async (ep) => store.writeEpisode(ep))
    },
    {
      name: 'kb_recent_episodes',
      description: 'List the most recent episode records.',
      input: { limit: z.number().int().min(1).max(50).optional() },
      run: kb(async ({ limit }) => ({ episodes: store.episodes({ limit: limit ?? 10 }) }))
    },
    {
      name: 'kb_rebuild_map',
      description: 'Regenerate the generated section of core/MAP.md after knowledge changes.',
      input: {},
      run: kb(async () => store.rebuildMap())
    },
    {
      name: 'kb_commit',
      description: 'Commit pending knowledge-base changes to Git.',
      input: { message: z.string().optional() },
      run: kb(async ({ message }) => store.commit(message))
    }
  ]

  // Every result carries chat and events (deaths, reflex fights, finished
  // background jobs) that arrived since the previous call.
  // A call whose client already timed out returns into nothing, so only the
  // latest call takes the inbox: events are never drained into a lost reply.
  const withInbox = tools.map(t => ({
    ...t,
    run: async (args) => {
      const mine = session.callSeq = (session.callSeq ?? 0) + 1
      const result = await t.run(args)
      if (session.callSeq !== mine) return result
      const inbox = session.drainInbox()
      return inbox.length && result && typeof result === 'object' ? { ...result, inbox } : result
    }
  }))

  return { tools: withInbox, session, store, locations, lib, tool: name => withInbox.find(t => t.name === name) }
}

/** A safe folder name for a world: letters, digits, dash and underscore. */
export function worldNameOf (world) {
  const name = String(world ?? '').trim() || 'default'
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error(`AUGI_WORLD must be letters, digits, - or _, got ${JSON.stringify(world)}`)
  return name
}

/** Per-worker overrides: AUGI_NIGHT_SHELTER=false keeps a guard out of the night shelter reflex. */
export function defensePolicyFromEnv (policy, env = process.env) {
  if (env.AUGI_NIGHT_SHELTER === undefined) return policy
  return { ...(policy ?? {}), nightShelter: !/^(false|0|off|no)$/i.test(env.AUGI_NIGHT_SHELTER) }
}

/** The game tools a config allows in lib: 'all' (default) or a list of names. */
export function libTools (tools, allowed = 'all') {
  if (allowed === 'all' || allowed == null) return tools
  if (!Array.isArray(allowed)) throw new Error(`config lib must be "all" or a list of tool names, got ${JSON.stringify(allowed)}`)
  const unknown = allowed.filter(n => !tools.some(t => t.name === n))
  if (unknown.length) throw new Error(`config lib names unknown tools: ${unknown.join(', ')}`)
  return tools.filter(t => allowed.includes(t.name))
}
