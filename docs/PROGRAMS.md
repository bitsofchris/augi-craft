# Programs

**Name:** run_program loop

**Description:** Workers control the bot by writing short async JavaScript
programs that run against the live Mineflayer bot. The program holds the fast
loop (chase, mine, build, fight); the LLM plans between programs. Reusable code
is saved as helper programs in the shared knowledge base.

**When to use:** every in-game action. Direct MCP tools remain only for
`observe`, `say`, `stop_action`, `bot_status`, `read_chat`, `wait_for_chat`,
`recall_location` and the kb tools.

## How it works

`runtime/program/tools.js` registers `run_program`. Each call runs inside
`BotSession.run` (lock, timeout, stop, inventory and position diff) and
compiles the code into a persistent `node:vm` context
(`runtime/program/runner.js`).

Scope available to a program:

| Name | What |
|---|---|
| `bot` | The Mineflayer bot behind a guard (`runtime/program/safety.js`): `chat` refuses `/` commands, `attack` refuses players, pets, villagers, golems and named mobs, `quit`/`end` are blocked. |
| `lib` | The tested actions in `runtime/tools` (`lib.navigate_to`, `lib.gather_blocks`, `lib.craft_item`, `lib.hunt_animals`, `lib.farm_wheat`, `lib.recall_location`, ...). Each resolves to `{ ok, summary, error, observations }`. `list_lib` lists them. `lib.on(event, fn)` adds a listener removed when the program ends. |
| `helpers` | Saved helper programs by camelCase id (`helpers.chaseAndStrike(args)`). |
| `log`, `sleep`, `signal`, timers | Logging (capped), cancellable `sleep`, `signal.check()`, `setTimeout`/`setInterval` cleared when the program ends. |
| `Vec3`, `goals`, `args` | vec3, mineflayer-pathfinder goals, the call arguments. |
| `globalThis` | Persists between programs until the MCP server restarts. |

Stopping: `stop_action`, the timeout, the self-defense reflex, or the bot dying
aborts the run (a death is reported in the inbox with the death position).
Abort clears timers and listeners, makes `sleep`, lib calls and every `bot`,
`bot.pathfinder`, `bot.tool` and `bot.collectBlock` method throw, and releases
the session lock even if the program ignores the signal.

Resume: a background job stopped by the self-defense reflex waits for the fight
to end and reruns (up to 3 times); a job ended by a death waits for the respawn
and reruns every time, including a death in a lost fight. Dying is a setback,
not a reason to give up; only `stop_action`, a new program or another failure
ends the job.
`resume: false` opts out. While a job waits to resume, `session.resumePending`
is set so the night reflex does not dig the bot in. Write programs that check
what is already done (inventory, position) first.

Results: `{ ok, summary, error, changes, observations: { returned, logs, line,
helpersUsed, health, food }, inbox }`. `line` is the program line of an error.
`inbox` carries chat, deaths, kicks, reflex fights and finished background jobs
since the previous tool call; every tool result has one when events are pending.

Background: `background: true` returns a `jobId`; `job_status` shows live logs
and the result. Only one movement-owning program runs per bot.

Defense: self-defense is on by default. `defense: "program"` disables the
reflex while that program runs, for guard programs that do their own fighting.

Listening: `wait_for_chat { seconds, names }` blocks while idle until a player
chats (or mentions one of `names`), a background job finishes, or the bot dies.

Key lib actions for player requests: `obtain_item` (plans an item back to raw
materials: gathers, mines visible ore, smelts, crafts, gets tools and stations),
`go_to_player` (follows a visible player; otherwise searches outward from the
newest sighting by any worker, kept in the Git-ignored
`$AUGI_HOME/knowledge/worlds/<world>/sightings.json`, and continues the search on the next call),
`give_items` (hands items over and verifies pickup), `shelter` (dig in for the
night), `guard_player`, `hunt_animals`.

## Helpers

`save_helper` stores a `kind: program` skill in `$AUGI_HOME/knowledge/learned/candidates/`
with the code in a `## Code` block. The code compiles before it is saved. It
follows the same lifecycle as any learned skill: `kb_record_outcome`,
`kb_promote` after successes from distinct episodes, `kb_deprecate`.
`store.programs()` loads all non-deprecated helpers into every run, so a saved
helper is available to every worker on its next program.

## Limits

`node:vm` prevents accidents, not a determined escape: a program can reach
host objects through `bot`. That is acceptable because worker controllers
already have shell access on this machine. A separate isolate per program is
the upgrade path if that changes.
