// The action library programs call as `lib.<name>(args)`. Each entry wraps a
// tested runtime handler (the V1 game tools) and runs it with the program's
// bot and lock, under its own stop signal and the tool's timeout.
//
// lib calls resolve to the handler's result ({ ok, summary, error, observations })
// rather than throwing, so programs branch on `res.ok`. A stopped program's
// lib calls throw, which ends the program.
import { z } from 'zod'
import { ErrorCategory, ToolError, categorize } from '../tools/result.js'

/** Stop pathfinding and controls after a lib call times out. */
function halt (bot) {
  try { bot.pathfinder?.stop() } catch {}
  try { bot.pathfinder?.setGoal(null) } catch {}
  try { bot.stopDigging?.() } catch {}
  try { bot.clearControlStates?.() } catch {}
  try { if (bot.currentWindow) bot.closeWindow(bot.currentWindow) } catch {}
}

/** Turn a tool registry into a lib factory: (ctx, run) => ({ name: fn }). */
export function createLib (tools) {
  const entries = tools.map(t => ({ name: t.name, description: t.description, schema: z.object(t.input).strict(), handler: t.handler, timeoutMs: t.timeoutMs ?? 120_000 }))
  const factory = (ctx, run) => {
    const lib = {}
    for (const e of entries) {
      lib[e.name] = async (args = {}) => {
        run.check()
        const parsed = e.schema.safeParse(args)
        if (!parsed.success) {
          return { ok: false, summary: `lib.${e.name}: ${parsed.error.issues.map(i => `${i.path.join('.') || 'args'} ${i.message}`).join('; ')}`, error: { category: ErrorCategory.INVALID_ARGUMENT, message: 'invalid arguments' }, observations: {} }
        }
        // A child signal: aborted when the program stops or this call times out,
        // so the handler's own checkAbort() calls end it.
        const own = { aborted: false }
        const signal = {
          get aborted () { return own.aborted || ctx.signal.aborted },
          get reason () { return ctx.signal.aborted ? ctx.signal.reason : own.aborted ? 'timeout' : null },
          get listeners () { return ctx.signal.listeners }
        }
        const callCtx = {
          ...ctx,
          signal,
          checkAbort () {
            if (ctx.signal.aborted) throw new ToolError(ErrorCategory.INTERRUPTED, `Action interrupted: ${ctx.signal.reason}`)
            if (own.aborted) throw new ToolError(ErrorCategory.TIMEOUT, `lib.${e.name} timed out after ${e.timeoutMs} ms`)
          }
        }
        let timer
        const timeout = new Promise(resolve => {
          timer = setTimeout(() => {
            own.aborted = true
            halt(ctx.bot)
            resolve({ ok: false, summary: `lib.${e.name} timed out after ${e.timeoutMs} ms`, error: { category: ErrorCategory.TIMEOUT, message: 'timed out' }, observations: {} })
          }, e.timeoutMs)
        })
        let res
        try {
          res = await Promise.race([
            Promise.resolve().then(() => e.handler(callCtx, parsed.data)).catch(err => {
              run.check()
              return { ok: false, summary: err.message, error: { category: err.category ?? categorize(err), message: err.message }, observations: err.observations ?? {} }
            }),
            timeout
          ])
        } finally {
          clearTimeout(timer)
        }
        run.check()
        return res
      }
    }
    lib.on = run.on
    return lib
  }
  factory.describe = () => entries.map(e => ({ name: e.name, description: e.description, args: Object.keys(e.schema.shape), timeoutMs: e.timeoutMs }))
  return factory
}
