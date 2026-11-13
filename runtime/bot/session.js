// BotSession owns the Mineflayer bot for one MCP server process and runs every
// game action through `run()`, which provides:
//   - a single-action lock (a second mutating action fails with `busy`)
//   - a hard timeout per action (then the action is stopped)
//   - cooperative cancellation via stop()
//   - automatic before/after inventory and position diffs in the result
import { installSelfDefense } from './self-defense.js'
import { DEFAULT_RELAY, parseVoiceChat } from '../voice/format.js'
import { CURSE_REFUSAL, addressedTo, isCursingOrder } from './no-cursing.js'
import { ErrorCategory, ToolError, categorize, diffCounts, inventoryCounts, roundPos } from '../tools/result.js'

export class BotSession {
  /**
   * @param {object} opts
   * @param {() => Promise<object>} [opts.connect] lazily creates a bot
   * @param {object} [opts.bot] an already-created bot (used by tests)
   * @param {object} [opts.locations] LocationStore
   * @param {object} [opts.sightings] SightingStore shared with the other workers
   * @param {number} [opts.defaultTimeoutMs]
   * @param {string} [opts.voiceRelay] character whose `[voice] player: text` lines count as that player's chat
   */
  constructor ({ connect, bot = null, locations = null, sightings = null, defaultTimeoutMs = 120_000, defensePolicy = null, voiceRelay = process.env.AUGI_VOICE_RELAY ?? DEFAULT_RELAY } = {}) {
    this.voiceRelay = voiceRelay
    this.defensePolicy = defensePolicy
    this.defenseState = { enabled: Boolean(defensePolicy), active: false, pending: null, paused: false, lastResult: null }
    this._connect = connect
    this.bot = bot
    this.locations = locations
    this.sightings = sightings
    this.defaultTimeoutMs = defaultTimeoutMs
    this.current = null // { tool, signal, startedAt }
    this.chatLog = []
    this.inbox = [] // chat and runtime events not yet delivered with a tool result
    this.lastSeen = {} // lowercase username -> { username, position, at } of other players
    this._connecting = null
    if (bot) this._attachBot(bot)
  }

  _attachBot (bot) {
    this.bot = bot
    if (this.defensePolicy) this._defense = installSelfDefense(this, bot)
    bot.on?.('chat', (username, message) => {
      if (username === bot.username) return
      const voice = parseVoiceChat(username, message, this.voiceRelay)
      const entry = voice
        ? { at: new Date().toISOString(), ...voice, via: 'voice' }
        : { at: new Date().toISOString(), username, message }
      // Orders to curse never reach the agent; the addressed bot refuses.
      if (isCursingOrder(entry.message)) {
        if (addressedTo(entry.message, bot.username)) {
          try { bot.chat(CURSE_REFUSAL) } catch {} // a failed reply must never break the event loop
        }
        return
      }
      this.chatLog.push(entry)
      if (this.chatLog.length > 50) this.chatLog.shift()
      this.note('chat', entry)
    })
    // A death invalidates whatever the running program assumed about position
    // and inventory, so it ends the program; a background job reruns after the
    // respawn (program/tools.js).
    bot.on?.('death', () => {
      this.deaths = (this.deaths ?? 0) + 1
      this.note('death', { message: 'bot died and respawned; check inventory and position (items may be at the death spot)', position: roundPos(bot.entity?.position) })
      if (this.current?.tool === 'run_program') this.stop('bot died')
    })
    const seen = e => {
      if (e?.type !== 'player' || !e.username || e.username === bot.username) return
      this.lastSeen[e.username.toLowerCase()] = { username: e.username, position: roundPos(e.position), at: new Date().toISOString() }
      try {
        this.sightings?.record({ username: e.username, position: e.position, dimension: bot.game?.dimension ?? null, by: bot.username })
      } catch {} // a failed shared write must never break the bot's event loop
    }
    bot.on?.('entityMoved', seen)
    bot.on?.('entitySpawn', seen)
    bot.on?.('kicked', reason => this.note('kicked', { reason: String(reason) }))
    bot.on?.('end', () => { if (this.bot === bot) this.bot = null })
  }

  /** Queue an event for delivery with the next tool result. */
  note (type, data = {}) {
    this.inbox.push({ type, at: data.at ?? new Date().toISOString(), ...data })
    if (this.inbox.length > 50) this.inbox.shift()
  }

  /** Take all undelivered events (chat, deaths, reflex actions). */
  drainInbox () {
    return this.inbox.splice(0)
  }

  async getBot () {
    if (this.bot) return this.bot
    if (!this._connect) throw new ToolError(ErrorCategory.NOT_CONNECTED, 'No bot connected and no connect function configured')
    if (!this._connecting) {
      this._connecting = this._connect()
        .then(bot => { this._attachBot(bot); return bot })
        .finally(() => { this._connecting = null })
    }
    try {
      return await this._connecting
    } catch (err) {
      throw new ToolError(ErrorCategory.NOT_CONNECTED, `Could not connect to Minecraft: ${err.message}`)
    }
  }

  /**
   * Run a tool handler under the session's lock/timeout/stop policy.
   * @param {string} tool tool name (for reporting)
   * @param {(ctx) => Promise<{ok, summary, error, observations}>} fn
   * @param {{timeoutMs?: number, exclusive?: boolean}} [opts]
   */
  async run (tool, fn, { timeoutMs, exclusive = true } = {}) {
    const startedAt = Date.now()
    const envelope = (res, before, posBefore, bot) => ({
      ok: res.ok,
      tool,
      summary: res.summary,
      error: res.error,
      changes: {
        inventory: bot ? diffCounts(before, inventoryCounts(bot)) : {},
        position: bot ? { from: posBefore, to: roundPos(bot.entity?.position) } : null
      },
      observations: res.observations ?? {},
      durationMs: Date.now() - startedAt
    })

    // Explicit work commands outrank automatic defense. Wait for its real
    // cleanup before granting movement ownership to the requested handler.
    if (exclusive && tool !== 'self_defense') {
      this.defenseState.paused = false
      if (this.current?.tool === 'self_defense' || this.defenseState.active || this.defenseState.pending) {
        const previous = this.current
        this._defense?.cancelPending()
        if (previous) {
          this.stop('requested work takes priority over self-defense')
          let timer
          try { await Promise.race([previous.settled, new Promise(resolve => { timer = setTimeout(resolve, 5000) })]) }
          finally { clearTimeout(timer) }
        }
      }
    }

    if (exclusive && this.current) {
      return envelope({ ok: false, summary: `Busy running ${this.current.tool}; call stop_action first`, error: { category: ErrorCategory.BUSY, message: `Busy running ${this.current.tool}` } }, {}, null, null)
    }

    let bot
    try {
      bot = await this.getBot()
    } catch (err) {
      return envelope({ ok: false, summary: err.message, error: { category: categorize(err), message: err.message } }, {}, null, null)
    }

    // Recheck after lazy connection: simultaneous first calls can share getBot().
    if (exclusive && this.current) {
      return envelope({ ok: false, summary: 'Busy; previous action is still cleaning up', error: { category: ErrorCategory.BUSY, message: 'Another action has priority' } }, {}, null, null)
    }
    const before = inventoryCounts(bot)
    const posBefore = roundPos(bot.entity?.position)
    const signal = { aborted: false, reason: null, listeners: [] }
    const ctx = {
      bot,
      session: this,
      locations: this.locations,
      signal,
      checkAbort () {
        if (signal.aborted) throw new ToolError(ErrorCategory.INTERRUPTED, `Action interrupted: ${signal.reason}`)
      }
    }
    const action = { tool, signal, startedAt }
    if (exclusive) this.current = action

    const limit = timeoutMs ?? this.defaultTimeoutMs
    let timer
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => {
        this.stop('timeout')
        resolve({ ok: false, summary: `${tool} timed out after ${limit}ms`, error: { category: ErrorCategory.TIMEOUT, message: `Timed out after ${limit}ms` } })
      }, limit)
    })

    let res
    const handler = Promise.resolve().then(() => fn(ctx)).catch(err => {
      const category = signal.aborted && !(err instanceof ToolError) ? ErrorCategory.INTERRUPTED : categorize(err)
      return { ok: false, summary: err.message, error: { category, message: err.message }, observations: err.observations ?? {} }
    })
    action.settled = handler.then(() => { if (this.current === action) this.current = null })
    try {
      res = await Promise.race([
        handler,
        timeout
      ])
    } finally {
      clearTimeout(timer)
      // Keep the lock until actual cleanup finishes, including after timeout.
    }
    return envelope(res, before, posBefore, bot)
  }

  /** Cancel whatever the bot is doing. Safe to call when idle. */
  stop (reason = 'stop requested') {
    if (reason === 'stop_action called') this._defense?.cancelPending()
    const running = this.current
    if (running) {
      running.signal.aborted = true
      running.signal.reason = reason
      for (const fn of running.signal.listeners.splice(0)) { try { fn() } catch {} }
    }
    const bot = this.bot
    if (bot) {
      try { bot.pathfinder?.stop() } catch {}
      try { bot.pathfinder?.setGoal(null) } catch {}
      try { bot.stopDigging?.() } catch {}
      try { bot.collectBlock?.cancelTask?.().catch?.(() => {}) } catch {}
      try { if (bot.currentWindow) bot.closeWindow(bot.currentWindow) } catch {}
      try { bot.clearControlStates?.() } catch {}
    }
    return { stopped: running?.tool ?? null, reason }
  }
}
