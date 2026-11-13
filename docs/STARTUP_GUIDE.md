# Start a server and a crew of workers

**Name:** crew startup

**Description:** run several bots at once, each its own Codex CLI session with
its own `augi-craft` MCP process and Minecraft character, sharing one
knowledge base in your instance ([INSTANCE.md](INSTANCE.md)).

**When to use:** play sessions where people want teammates: gathering, food,
building, protection. For one bot, the README's Claude Code path is enough.
The launcher needs **tmux** and **Codex CLI** (Mac or Linux; Windows through
WSL). On Windows without WSL, start one Claude Code session per bot by hand
instead, each with its own `MC_USERNAME`.

## 1. Start the server

A dedicated server (README, option B) is best for a crew: it keeps running
when you log out. Start it from its own folder, for example:

```bash
cd ~/.augi-craft/server && java -Xmx4G -jar paper.jar nogui
```

- **Java players:** Multiplayer → Direct Connection → `localhost:25565`.
- **Console and tablet players:** install [Geyser](https://geysermc.org) and
  Floodgate on the server (Paper) so Bedrock players on the same Wi-Fi find it
  under Friends → LAN Games. Their names start with a dot in game; use that
  spelling in `crew.json`.
- **Server console:** type commands there without `/`. In tmux, detach with
  **Ctrl-b**, then **d**; do not press Ctrl-c just to leave.

Keep the server on your home network. No port forwarding is needed.

## 2. Allow players and bot names

Only a dedicated server with `white-list=true` needs this; a world opened to
LAN has no whitelist. In the server console, once per name:

```text
whitelist add Guard
whitelist add DiamondMiner
whitelist add Agent1
whitelist add AugiEars        # the voice relay, if you use voice orders
```

Use `fwhitelist add <gamertag>` (Floodgate, no leading dot) for Bedrock
players. Add every bot in `crew.json` before launching it; `whitelist list`
shows the current list. Give yourself op (`op <name>`) for camera and
teleport commands.

## 3. Launch the crew

```bash
export AUGI_HOME=~/.augi-craft          # if not the default
scripts/start-crew.sh                   # gatherer hunter builder guard
scripts/start-crew.sh guard diamond agent1 agent2   # any roles or usernames from crew.json
tmux attach -t augi-crew
```

Each pane runs one worker. The launcher reads the model, reasoning effort,
server connection and world from `crew.json`, and tells each worker who its
player is (`player` in its crew entry). Workers share `$AUGI_HOME/knowledge`
through the runtime's cross-process lock.

| Role | Character (example crew) | Standing job |
|---|---|---|
| gatherer | Gatherer | logs, stone, ores, deliveries on request |
| hunter | Hunter | keep the food chest stocked |
| builder | Builder | building, repair, lighting, storage on request |
| guard | Sentry | follow players, patrol the base |
| bodyguard | Guard | stay with its player and fight mobs |
| diamond | DiamondMiner | mine iron and diamonds for its player |
| agent | Agent1 to Agent4 | any order |

Role files are in `agents/crew/`. Workers start idle (or on their standing
job), say hello in chat and wait for orders:

> Hunter, we need food. Hunt 4 animals, cook them and put the food in the base chest.

### Operate the panes

- Click a pane to talk directly to its worker.
- **Ctrl-b z** zooms a pane; **Ctrl-b d** detaches and leaves workers running.
- **Ctrl-c** interrupts a Codex turn; then tell the worker to call `stop_action`.
- `scripts/restart-worker.sh <role>` restarts one worker without leaving an
  orphaned MCP server behind (which would kick the new one off the server).

Detaching does not pause work: background programs keep running until they
finish, time out, or a worker calls `stop_action`.

### Add a role

1. Pick a unique username and whitelist it.
2. Write `agents/crew/<role>.md` (role tag, what good looks like, helpers
   worth building, limits), following the existing ones. Keep it general:
   names and places come from `crew.json` and world state.
3. Add the worker to `$AUGI_HOME/crew.json` with `role`, `username`,
   `instructions` and, if the role serves one person, `player`.
4. `scripts/start-crew.sh <role>` or `agents/crew/start-worker.sh <role>`.

Never run two controllers for one username: the server kicks the first.

### Codex settings

The launcher passes `-c` flags for the model, tool approvals and the compaction
budget (`AUGI_CODEX_COMPACT_TOKENS`, default 80000). Extra flags go in
`$AUGI_HOME/codex.extra`, one per line, for example to turn off other MCP
servers from your Codex config:

```
-c mcp_servers.playwright.enabled=false
```

`CODEX_BIN` overrides where Codex is found.

## Optional: voice orders

Whitelist the relay (`whitelist add AugiEars`), then `scripts/start-voice.sh`
and open the printed `https://<your-ip>:8443` on a tablet. See [VOICE.md](VOICE.md).

## Optional: record replays

`AUGI_RECORD=1 scripts/start-crew.sh ...` saves a ReplayMod replay per bot in
`$AUGI_HOME/recordings`. See [RECORDING.md](RECORDING.md).

## 4. Stop and back up

1. Tell each worker: "Call stop_action, report your inventory and position,
   then wait."
2. Exit each Codex session (`/exit`), then `tmux kill-session -t augi-crew`.
3. Stop the server (`stop` in its console) and copy its world folder to a
   dated backup. `kb_commit`, or `git commit` in `$AUGI_HOME`, keeps the
   knowledge history.

## Troubleshooting

- **Not whitelisted:** add the exact Java name, or `fwhitelist add` for Bedrock.
- **"You logged in from another location":** two processes control one
  character; use `scripts/restart-worker.sh`.
- **Worker has old tools:** source edits do not reach a running MCP process;
  restart that worker.
- **Usage limits stop the whole crew at once:** check your plan's headroom
  before a long session, and run fewer bots.
- **A phone never reaches the voice page:** different Wi-Fi, a guest network,
  or cellular data. The voice log lists every address the page answers on.
