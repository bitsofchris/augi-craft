# Worker crew

**Name:** worker crew

**Description:** A crew of Augi workers, each one Codex session with its own MCP
server and Minecraft character, acting as teammates who do what players ask.

**When to use:** play sessions where players want help gathering,
food, building or protection. Launch with `./scripts/start-crew.sh` (see
[STARTUP_GUIDE.md](STARTUP_GUIDE.md)).

## How it works

| Role | Character | Owns | Role file |
|---|---|---|---|
| gatherer | Gatherer | logs, stone, ores, deliveries | `agents/crew/gatherer.md` |
| hunter | Hunter | standing job: keep the food chest stocked; hunting, fishing, cooking, feeding | `agents/crew/hunter.md` |
| builder | Builder | building, repair, lighting, storage | `agents/crew/builder.md` |
| guard | Sentry | following players, base patrol, fighting mobs | `agents/crew/guard.md` |
| bodyguard | Guard | standing job: follow and protect its player (`player` in crew.json) | `agents/crew/bodyguard.md` |
| diamond | DiamondMiner | standing job: mine iron and diamonds, announce veins, deliver to its player | `agents/crew/diamond.md` |
| agent | Agent1 to Agent4 | any order: build, craft, gather, fetch; Agent1 takes unnumbered "agent" orders | `agents/crew/agent.md` |

- **Requests come from chat.** Players ask in game chat; every tool result's
  `inbox` delivers it. A worker takes work that fits its role and hands off the
  rest by name in chat.
- **Each role learns programs.** Workers write `run_program` code and save what
  works as helpers tagged with their role (`save_helper`). A new worker in the
  same role starts from those helpers through `list_helpers {role}`.
- **Shared knowledge.** All workers use one knowledge directory (`$AUGI_HOME/knowledge`) through the kb
  tools, which serialize writes across processes with `$AUGI_HOME/knowledge/.augi-write.lock`
  (`runtime/memory/lock.js`). Workers never edit knowledge files or run git
  themselves; commit with `kb_commit` or by hand.
- **Ownership.** One controller per character. Never start a second process for
  a username that is already connected; the server kicks the first one.

## Limits

- No supervisor enforces job time budgets; background programs end on their
  own timeout (max 900 s) or `stop_action`.
- Each worker reloads runtime changes only when its MCP server restarts.
- Restart one worker with `scripts/restart-worker.sh <role>`. It also stops any
  orphaned MCP server still logging in as that character; a plain
  `tmux respawn-pane -k` can leave one behind, which then kicks the new
  worker ("You logged in from another location").

`scripts/start-crew.sh guard diamond hunter agent1 agent2` starts a crew for
a play session with kids (a bodyguard, a diamond miner, food, two general
agents). Any role or username from `crew.json` works.
A role file with a
standing job starts it without an order and keeps its turn alive while the
job runs.
