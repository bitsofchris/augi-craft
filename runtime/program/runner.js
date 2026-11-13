// Runs agent-written JavaScript programs against the bot.
//
// A program is the body of an async function. It sees a small scope:
//   bot      the Mineflayer bot (chat and attack are guarded, see safety.js)
//   lib      the runtime's tested actions (navigate_to, gather_blocks, ...)
//   helpers  agent-saved helper programs from the knowledge base
//   humans() usernames of the people online (not crew bots)
//   log, sleep, signal, setTimeout/setInterval, Vec3, goals, args
//   globalThis  persists between programs for this session (like the paper's globals)
//
// Programs run inside BotSession.run, so they get its lock, timeout, stop and
// inventory/position diff. Stopping a program is enforced here: once stopped,
// sleep() and lib calls throw, timers are cleared, listeners are removed, and
// the session lock is released even if the program ignores the signal.
import vm from 'node:vm'
import { Vec3 } from 'vec3'
import pathfinderPkg from 'mineflayer-pathfinder'
import { ErrorCategory, ToolError, categorize, fail, ok } from '../tools/result.js'
import { guardBot } from './safety.js'
import { humanPlayers } from '../bot/crew.js'

const { goals } = pathfinderPkg
const MAX_LOG_LINES = 200
const MAX_LOG_CHARS = 20_000
const MAX_RETURN_CHARS = 8_000

/** Thrown inside a program once it has been stopped or timed out. */
export class ProgramStopped extends ToolError {
  constructor (reason) { super(ErrorCategory.INTERRUPTED, `Program stopped: ${reason}`) }
}

/** One persistent sandbox context per bot session. */
export function createProgramContext () {
  return vm.createContext({}, { name: 'augi-program', codeGeneration: { strings: false, wasm: false } })
}

/** camelCase name for a helper id: "chase-and-strike" -> "chaseAndStrike". */
export function helperName (id) {
  return String(id).replace(/[-_]+([a-z0-9])/g, (_, c) => c.toUpperCase())
}

const SCOPE = 'bot, lib, helpers, humans, log, sleep, signal, setTimeout, setInterval, clearTimeout, clearInterval, Vec3, goals, args'

/** Compile program text. The header stays on line 1 so stack line N maps to program line N-1. */
export function compile (code, context, filename = 'program.js') {
  const src = `(async function (__scope) { const { ${SCOPE} } = __scope;\n${code}\n})`
  return new vm.Script(src, { filename }).runInContext(context)
}

/**
 * Run one program. Called as a BotSession.run handler.
 * @param {object} ctx BotSession run context ({ bot, signal, ... })
 * @param {object} opts
 * @param {string} opts.code program body
 * @param {object} [opts.args] value passed as `args`
 * @param {object} opts.context vm context from createProgramContext
 * @param {object} opts.lib action library (see lib.js)
 * @param {Array<{id, code}>} [opts.helpers] helper programs to expose
 * @param {Array<string>} [opts.logs] array to append log lines to (live view for background jobs)
 */
export async function runProgram (ctx, { code, args = {}, context, lib, helpers = [], logs = [] }) {
  const { signal } = ctx
  const run = createRunScope(ctx, logs)
  const helpersUsed = new Set()
  const helperErrors = []

  try {
    const scope = { ...run.scope, args, lib: lib(ctx, run), helpers: {} }
    for (const h of helpers) {
      let fn
      try { fn = compile(h.code, context, `helper:${h.id}.js`) } catch (err) { helperErrors.push({ id: h.id, message: err.message }); continue }
      scope.helpers[helperName(h.id)] = async (helperArgs = {}) => {
        run.check()
        helpersUsed.add(h.id)
        return fn({ ...scope, args: helperArgs })
      }
    }

    let program
    try {
      program = compile(code, context)
    } catch (err) {
      return fail(ErrorCategory.INVALID_ARGUMENT, `Program does not compile: ${err.message}`, { logs, helperErrors })
    }

    const returned = await Promise.race([program(scope), run.stopped])
    return ok(`Program finished${logs.length ? ` (${logs.length} log lines)` : ''}`, {
      returned: serialize(returned), logs, helpersUsed: [...helpersUsed], helperErrors, ...vitals(ctx.bot)
    })
  } catch (err) {
    const category = signal.aborted ? ErrorCategory.INTERRUPTED : categorize(err)
    return fail(category, err.message, {
      logs, line: programLine(err), helpersUsed: [...helpersUsed], helperErrors, ...vitals(ctx.bot)
    })
  } finally {
    run.cleanup()
  }
}

/** Per-program scope: logging, cancellable sleep and timers, tracked listeners. */
function createRunScope (ctx, logs) {
  const { signal, bot } = ctx
  const timers = new Set()
  const intervals = new Set()
  const listeners = []
  let chars = 0
  let rejectStopped
  const stopped = new Promise((resolve, reject) => { rejectStopped = reject })
  stopped.catch(() => {})

  const check = () => { if (signal.aborted) throw new ProgramStopped(signal.reason) }
  const onAbort = () => {
    clear()
    rejectStopped(new ProgramStopped(signal.reason))
  }
  if (signal.aborted) onAbort()
  else (signal.listeners ??= []).push(onAbort)

  function clear () {
    for (const t of timers) clearTimeout(t)
    for (const t of intervals) clearInterval(t)
    timers.clear(); intervals.clear()
    for (const [event, fn] of listeners.splice(0)) bot.removeListener?.(event, fn)
  }

  const log = (...parts) => {
    if (logs.length >= MAX_LOG_LINES || chars >= MAX_LOG_CHARS) return
    const line = parts.map(p => typeof p === 'string' ? p : JSON.stringify(serialize(p))).join(' ')
    chars += line.length
    logs.push(chars >= MAX_LOG_CHARS ? `${line.slice(0, 200)} …(log truncated)` : line)
  }

  const scope = {
    bot: guardBot(bot, { stopped: () => signal.aborted, error: () => new ProgramStopped(signal.reason) }),
    humans: () => humanPlayers(bot),
    log,
    signal: { get aborted () { return signal.aborted }, check },
    sleep: ms => new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new ProgramStopped(signal.reason))
      const t = setTimeout(() => { timers.delete(t); signal.aborted ? reject(new ProgramStopped(signal.reason)) : resolve() }, Math.max(0, Number(ms) || 0))
      timers.add(t)
    }),
    setTimeout: (fn, ms) => {
      check()
      const t = setTimeout(() => { timers.delete(t); if (!signal.aborted) fn() }, ms)
      timers.add(t)
      return t
    },
    setInterval: (fn, ms) => {
      check()
      const t = setInterval(() => { if (!signal.aborted) fn() }, Math.max(10, Number(ms) || 0))
      intervals.add(t)
      return t
    },
    clearTimeout: t => { clearTimeout(t); timers.delete(t) },
    clearInterval: t => { clearInterval(t); intervals.delete(t) },
    Vec3,
    goals
  }

  return {
    scope,
    check,
    stopped,
    /** Listen to a bot event for this program only; removed when it ends. */
    on (event, fn) {
      check()
      const wrapped = (...a) => { if (!signal.aborted) fn(...a) }
      bot.on(event, wrapped)
      listeners.push([event, wrapped])
      return () => { bot.removeListener(event, wrapped) }
    },
    cleanup () {
      clear()
      const i = signal.listeners?.indexOf(onAbort) ?? -1
      if (i >= 0) signal.listeners.splice(i, 1)
    }
  }
}

function vitals (bot) {
  return { health: bot?.health ?? null, food: bot?.food ?? null }
}

/** Map a stack frame in program.js back to the agent's line number. */
function programLine (err) {
  const m = /program\.js:(\d+)/.exec(err?.stack ?? '')
  return m ? Math.max(1, Number(m[1]) - 1) : null
}

/** JSON-safe, size-capped copy of a value (handles Vec3, cycles, bigints). */
export function serialize (value) {
  if (value === undefined) return null
  const seen = new WeakSet()
  let text
  try {
    text = JSON.stringify(value, (k, v) => {
      if (typeof v === 'bigint') return Number(v)
      if (typeof v === 'function') return undefined
      if (v && typeof v === 'object') {
        if (seen.has(v)) return '[circular]'
        seen.add(v)
      }
      return v
    })
  } catch (err) {
    return String(value)
  }
  if (text === undefined) return null
  if (text.length > MAX_RETURN_CHARS) return `${text.slice(0, MAX_RETURN_CHARS)} …(truncated)`
  return JSON.parse(text)
}
