---
id: guard-until-stopped
title: Guard a player until stopped
description: 'Continuous bodyguard: back-to-back lib.guard_player shifts with no gaps, day and night. Between shifts it eats, catches up with the player (searching for them when out of sight, waiting at base if not found), and announces kills. It ends only when a player says stop, the guarded player logs off for a minute, or the time budget runs out (restart it at once). Run it with defense: "program" in the background.'
kind: program
level: 2
when:
  - protect a player
  - bodyguard standing job
  - guard someone at night
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.guardUntilStopped({ username, seconds = 880, distance = 4, useBow = true })"
status: candidate
source:
  origin: learned
  created: 2026-10-17T20:25:37.288Z
  updated: 2026-10-18T14:30:00.000Z
version: 2
evidence: []
stats:
  successes: 0
  failures: 0
failure_modes: []
tags:
  - bodyguard
  - guard
---

Continuous bodyguard: back-to-back lib.guard_player shifts with no gaps, day and night. Between shifts it eats, catches up with the player (searching for them when out of sight, waiting at base if not found), and announces kills. It ends only when a player says stop, the guarded player logs off for a minute, or the time budget runs out (restart it at once). Run it with defense: "program" in the background.

Args: `{ username, seconds = 880, distance = 4, useBow = true }`

## Code

```js
// Guard one player without gaps until told to stop. Shifts of lib.guard_player run
// back to back; between them: eat, catch up, announce kills. Never shelters or hides.
const { username, seconds = 880, distance = 4, useBow = true } = args
if (!username) throw new Error('guardUntilStopped needs { username }: the player to guard')
const end = Date.now() + seconds * 1000
const FOODS = ['cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_cod', 'cooked_salmon', 'bread', 'baked_potato', 'carrot', 'apple', 'beef', 'porkchop', 'mutton', 'rabbit']
let stopped = null
const me = bot.username.toLowerCase()
lib.on('chat', (from, message) => {
  if (from === bot.username || /^augi/i.test(from)) return
  const m = message.toLowerCase()
  // "stop", "Guard stop", "stop guarding": from the guarded player, or naming this bot.
  if (/\bstop\b/.test(m) && (from === username || m.includes(me) || m.includes('guard'))) stopped = `${from}: ${message}`
})
const struck = new Set(); const announced = new Set()
lib.on('entityHurt', (e, source) => { if (source === bot.entity && ['creeper', 'skeleton', 'zombie', 'spider'].includes(e?.name)) struck.add(e.id) })
lib.on('entityDead', e => {
  const p = bot.players[username]?.entity
  if (struck.has(e.id) && !announced.has(e.id) && p && e.position.distanceTo(p.position) <= 16) { announced.add(e.id); bot.chat(`got that ${e.name}!`) }
})
let shifts = 0; let missingSince = null; let atBase = false
while (!stopped && Date.now() < end) {
  signal.check()
  if (bot.food < 14) {
    const food = bot.inventory.items().find(i => FOODS.includes(i.name))
    if (food) await lib.eat_food({ item: food.name })
  }
  if (!bot.players[username]) {
    missingSince ??= Date.now()
    if (Date.now() - missingSince > 60000) { stopped = `${username} logged off`; break }
    await sleep(1000); continue
  }
  missingSince = null
  const p = bot.players[username].entity
  if (!p || bot.entity.position.distanceTo(p.position) > 12) {
    // go_to_player searches around the newest sighting by any worker; each call
    // continues the search. Never ask the player for coordinates.
    const r = await lib.go_to_player({ username, range: distance, seconds: 60 })
    if (!r.ok) {
      if (r.observations?.exhausted) {
        // Searched everywhere nearby: wait at base, where players come back to.
        if (!atBase) { bot.chat(`can't find ${username.replace(/^\./, '')}, waiting at base`); atBase = true }
        await lib.navigate_to({ location: 'base_entrance', range: 3, walkOnly: true })
        for (let t = 0; t < 120 && !stopped && !bot.players[username]?.entity; t++) await sleep(1000)
      } else await sleep(500)
      continue
    }
  }
  atBase = false
  const left = Math.floor((end - Date.now()) / 1000)
  if (left < 5) break
  const r = await lib.guard_player({ username, distance, seconds: Math.min(120, left), useBow })
  shifts++
  if (!r.ok && r.error?.category !== 'timeout') { log(`shift ${shifts}: ${r.summary}`); await sleep(500) }
}
if (stopped) bot.chat(`ok, I stopped guarding (${stopped})`)
return { shifts, stopped, timeLeft: Math.max(0, Math.round((end - Date.now()) / 1000)), health: bot.health, food: bot.food }
```

## Notes

Replaces gaps between 120 s guard_player calls; during those gaps the night reflex used to shelter the guard away from its player. Guards now also run with AUGI_NIGHT_SHELTER=false. Run: run_program({ code: 'return await helpers.guardUntilStopped({ username: "<player>" })', background: true, defense: 'program', timeoutSeconds: 900 }), then start it again as soon as job_status shows it finished, unless stopped is true.
