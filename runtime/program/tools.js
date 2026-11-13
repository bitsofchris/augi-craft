// MCP tools for the program loop: run_program, job_status, list_lib,
// list_helpers, save_helper.
import { z } from 'zod'
import { compile, createProgramContext, helperName, runProgram } from './runner.js'

const FOREGROUND_MAX_S = 280 // stays under the MCP client's 300 s tool timeout
const BACKGROUND_MAX_S = 900
const KEEP_JOBS = 20
const MAX_RESUMES = 3
const RESPAWN_SETTLE_MS = 3000
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * @param {object} opts
 * @param {import('../bot/session.js').BotSession} opts.session
 * @param {import('../memory/store.js').KnowledgeStore} opts.store
 * @param {Function} opts.lib factory from createLib
 */
export function createProgramTools ({ session, store, lib }) {
  const context = createProgramContext()
  const jobs = new Map()
  let nextJob = 1

  const start = ({ code, args, timeoutSeconds, background, defense, resume }) => {
    const id = `job-${nextJob++}`
    const job = { id, status: 'running', startedAt: new Date().toISOString(), background: Boolean(background), logs: [], result: null }
    jobs.set(id, job)
    for (const old of [...jobs.keys()].slice(0, Math.max(0, jobs.size - KEEP_JOBS))) jobs.delete(old)

    const max = background ? BACKGROUND_MAX_S : FOREGROUND_MAX_S
    const seconds = Math.min(max, Math.max(1, timeoutSeconds ?? 60))
    const helpers = store.programs()
    const handler = async ctx => {
      const ownsDefense = defense === 'program'
      if (ownsDefense) session.travelDefenseActive = true
      try {
        return await runProgram(ctx, { code, args, context, lib, helpers, logs: job.logs })
      } finally {
        if (ownsDefense) session.travelDefenseActive = false
      }
    }
    // The self-defense reflex interrupts work when a mob attacks, and a death
    // ends the program. A background job reruns once the fight is over or the
    // bot has respawned. Deaths never end a job (dying is a setback, not a
    // reason to give up); only stop_action, a new program or another failure
    // does. Programs should check what is already done before redoing it.
    const resumable = job.background && resume !== false
    const runWithResume = async () => {
      let result
      let fights = 0; let deaths = 0
      for (;;) {
        result = await session.run('run_program', handler, { timeoutMs: seconds * 1000 })
        const byDefense = !result.ok && /self-defense priority/.test(result.summary ?? '')
        let byDeath = !result.ok && /bot died/.test(result.summary ?? '')
        if (!resumable || !(byDefense || byDeath)) break
        // Tell the night reflex this bot is busy: it must not dig in instead.
        session.resumePending = (session.resumePending ?? 0) + 1
        try {
          for (let waited = 0; waited < 90_000 && (session.current || session.defenseState.active || session.defenseState.pending || !(session.bot?.health > 0)); waited += 250) await sleep(250)
          // A fight the bot lost is a death, not one of the limited fight resumes.
          if (byDefense && /bot died/.test(session.defenseState.lastResult?.summary ?? '')) byDeath = true
          if (byDeath) await sleep(session.respawnSettleMs ?? RESPAWN_SETTLE_MS) // let the respawned bot load chunks before moving
        } finally {
          session.resumePending--
        }
        if (session.current || !(session.bot?.health > 0)) break
        if (byDeath) {
          deaths++
          job.logs.push(`-- bot died; respawned, resuming (death ${deaths}) --`)
        } else {
          if (fights >= MAX_RESUMES) break
          fights++
          job.logs.push(`-- interrupted by self-defense (${session.defenseState.lastResult?.summary ?? 'fight'}); resuming ${fights}/${MAX_RESUMES} --`)
        }
        job.resumes = fights + deaths
        job.deaths = deaths
      }
      return result
    }
    job.promise = runWithResume().then(result => {
      job.status = result.ok ? 'done' : 'failed'
      job.finishedAt = new Date().toISOString()
      job.result = { ...result, jobId: id, resumes: job.resumes ?? 0, deaths: job.deaths ?? 0 }
      if (job.background) session.note('job_finished', { jobId: id, ok: result.ok, summary: result.summary })
      return job.result
    })
    return job
  }

  return [
    {
      name: 'run_program',
      description: [
        'Run a JavaScript program (the body of an async function) that controls the bot.',
        lib.describe().length
          ? 'In scope: bot (Mineflayer; chat/attack guarded), lib (tested actions: await lib.navigate_to({x,y,z}) → {ok, summary, error, observations}; see list_lib),'
          : 'In scope: bot (Mineflayer; chat/attack guarded), lib (no game actions in this config: write them yourself with bot, goals and Vec3, then save_helper),',
        'helpers (saved helper programs by camelCase name, e.g. await helpers.chaseAndStrike({...})), humans() (people online, not crew bots), log(...), sleep(ms), signal.check(), setTimeout/setInterval,',
        'Vec3, goals (mineflayer-pathfinder), args. globalThis persists between programs this session. lib.on(event, fn) adds a listener removed when the program ends.',
        'Write loops that react inside the program (poll every 50–250 ms) instead of one tool call per step. Return a value to report it.',
        'Result: {ok, summary, error, changes: {inventory, position}, observations: {returned, logs, line, helpersUsed, health, food}, inbox}.',
        'background=true returns a jobId at once; read it with job_status. One movement-owning program at a time; stop_action stops it.',
        'Self-defense stays on by default: when a mob attacks, the reflex fights and the program stops. Background jobs then rerun automatically (resume: up to 3 times after fights, and after every death once the bot respawns), so write programs that skip work already done.',
        'defense="program" disables the reflex while the program runs, only for programs that do their own fighting.'
      ].join(' '),
      input: {
        code: z.string().min(1),
        args: z.record(z.any()).optional(),
        timeoutSeconds: z.number().int().min(1).max(BACKGROUND_MAX_S).optional().describe(`Default 60. Max ${FOREGROUND_MAX_S} in the foreground, ${BACKGROUND_MAX_S} in the background.`),
        background: z.boolean().optional(),
        defense: z.enum(['reflex', 'program']).optional(),
        resume: z.boolean().optional().describe('Background jobs rerun after the self-defense reflex interrupts them (up to 3 times) and after every death once the bot respawns. Default true.')
      },
      run: async (spec) => {
        if (session.current) {
          return { ok: false, tool: 'run_program', summary: `Busy running ${session.current.tool}; wait (job_status) or stop_action first`, error: { category: 'busy', message: 'busy' } }
        }
        const job = start(spec)
        if (!spec.background) return job.promise
        const early = await Promise.race([job.promise, new Promise(resolve => setTimeout(resolve, 100, null))])
        return early ?? { ok: true, tool: 'run_program', summary: `Started ${job.id} in the background. wait_for_chat wakes you with a job_finished event when it ends; do not poll job_status meanwhile.`, jobId: job.id }
      }
    },
    {
      name: 'job_status',
      description: 'Status, live logs and final result of a program job (omit jobId to list recent jobs).',
      input: { jobId: z.string().optional(), tail: z.number().int().min(1).max(200).optional().describe('Log lines to return, default 10') },
      run: async ({ jobId, tail }) => {
        if (!jobId) {
          return { ok: true, jobs: [...jobs.values()].reverse().map(j => ({ id: j.id, status: j.status, background: j.background, startedAt: j.startedAt, finishedAt: j.finishedAt ?? null, summary: j.result?.summary ?? null })) }
        }
        const job = jobs.get(jobId)
        if (!job) return { ok: false, error: { category: 'not_found', message: `No job ${jobId}` } }
        return { ok: true, id: job.id, status: job.status, startedAt: job.startedAt, logs: job.logs.slice(-(tail ?? 10)), result: job.result }
      }
    },
    {
      name: 'list_lib',
      description: 'List the lib actions available to programs, with their argument names and descriptions.',
      input: {},
      run: async () => ({ ok: true, lib: lib.describe() })
    },
    {
      name: 'list_helpers',
      description: 'List saved helper programs (callable as helpers.<camelCaseName> in programs), with status and evidence counts.',
      input: { role: z.string().optional() },
      run: async ({ role }) => ({
        ok: true,
        helpers: store.programs({ includeCode: false })
          .filter(h => !role || (h.tags ?? []).includes(role) || (h.tags ?? []).includes('shared'))
          .map(h => ({ ...h, call: `helpers.${helperName(h.id)}(args)` }))
      })
    },
    {
      name: 'save_helper',
      description: [
        'Save a helper program to the shared knowledge base so every worker can call it as helpers.<camelCaseName>(args).',
        'code is the body of an async function with the same scope as run_program, where args is the call argument. Return a result object.',
        'Run it on a short task first. New helpers start as candidates; record verified outcomes with kb_record_outcome and promote with kb_promote.',
        'Tag with a role (gatherer, hunter, builder, guard) or "shared".'
      ].join(' '),
      input: {
        id: z.string().optional(),
        title: z.string(),
        description: z.string(),
        code: z.string().min(1),
        args: z.string().optional().describe('What args the helper takes, e.g. "{ radius = 24, maxKills = 3 }"'),
        when: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        failure_modes: z.array(z.string()).optional(),
        episode: z.string().optional(),
        outcome: z.enum(['success', 'failure']).optional(),
        force: z.boolean().optional()
      },
      run: async ({ force, ...spec }) => {
        try {
          compile(spec.code, context, `helper:${spec.id ?? spec.title}.js`)
        } catch (err) {
          return { ok: false, error: { category: 'invalid_argument', message: `Helper does not compile: ${err.message}` } }
        }
        try {
          const res = store.saveSkill({ ...spec, kind: 'program' }, { force })
          return { ok: true, ...res, call: res.id ? `helpers.${helperName(res.id)}(args)` : undefined }
        } catch (err) {
          return { ok: false, error: { category: 'invalid_argument', message: err.message } }
        }
      }
    }
  ]
}
