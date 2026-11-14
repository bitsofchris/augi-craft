# augi-craft: Minecraft teammates that learn

Minecraft bots you give orders to in chat. Each one is an LLM agent (Claude
Code or Codex CLI) driving a [Mineflayer](https://github.com/PrismarineJS/mineflayer)
character. It plays by writing short JavaScript programs, keeps the code that
worked as helpers, and writes down what it learned in a shared Markdown
knowledge base. One bot learns to open doors; the next one already knows.

```
"Hunter, we need food"        "Guard, stay with me"        "DiamondMiner, get me diamonds"
```

Built by a dad and two kids over a few weeks of evenings. Inspired by
[Voyager](https://github.com/MineDojo/Voyager) and by "A team of Gemini 4 Argon
agents beats Minecraft" (arXiv 2610.22319): the program holds the fast
reactive loop (chase, mine, build, fight) and the LLM plans between programs.

## In plain words

**What it is.** AI helpers that join your Minecraft world as extra players.
Type "Hunter, we need food" in chat and a bot goes and does it. Each bot is
run by an AI assistant (Claude Code or Codex) on your computer. After every
job it writes down what worked, so the next job goes better, and every other
bot can read those notes.

**What you need.**

- A Mac, Windows or Linux computer.
- Minecraft: Java Edition 26.3. Xbox, Switch and iPad players can join
  through the free Geyser add-on.
- A paid Claude or ChatGPT plan that includes Claude Code or Codex. Bots use
  it up fast, so start with one.
- About 30 minutes, and a willingness to paste commands into a terminal.

**How to start.**

1. Install Node.js, Git and Claude Code.
2. Download this project, open its folder in Claude Code and paste the prompt
   under [For agents setting this up](#for-agents-setting-this-up). Claude
   does the installing.
3. In Minecraft, open your world, press `Esc`, choose **Open to LAN** and
   note the port number shown in chat.
4. Restart Claude Code with that port (`MC_PORT=54321 claude`), type
   `/play make starter tools`, and watch the bot join.

**Safety.** Everything runs on your computer and your home network. Never
open the server to the internet: see [Security](#security).

## How it is built

```
 Claude Code / Codex CLI  ──MCP(stdio)──►  runtime/mcp/server.js
                                              │
        run_program ─► runtime/program  (vm context · lib · helpers · guards · jobs)
                                              │
                         BotSession.run  (lock · timeout · stop · diffs · inbox)
                                              │
                         Mineflayer bot      Knowledge base (Git, in $AUGI_HOME):
                                             learned skills · helpers · episodes · worlds
```

| Level | What | Who can change it |
|---|---|---|
| 0 | `lib` action library (`runtime/tools`) that programs call | You, with tests ([docs/CAPABILITY_DEVELOPMENT.md](docs/CAPABILITY_DEVELOPMENT.md)) |
| 1 | Seed plans (`knowledge/seeds/<pack>`) | Humans; read-only to the agent |
| 2 | Learned plans, lessons and helper programs (`$AUGI_HOME/knowledge/learned`) | The agent, via `kb_*` and `save_helper` |

Map of code and docs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Two folders, by design

- **This repository** is the app: runtime, tests, seed skills, the agents'
  operating protocol and a starter pack: the skills and helper programs one
  crew learned, copied into your instance on first use. Nothing personal
  lives here, and a publish check keeps it that way ([docs/PUBLISHING.md](docs/PUBLISHING.md)).
- **Your instance**, `AUGI_HOME` (default `~/.augi-craft`), holds everything
  personal: your crew and players, what your bots learn, saved places in your
  worlds, voice recordings, replays. Make it its own private Git repository
  if you want history. See [docs/INSTANCE.md](docs/INSTANCE.md).

## Setup

You need **Minecraft: Java Edition** (Bedrock players can join through Geyser,
see below), **Node.js 22+** and **Git**. Mac, Linux and Windows all work for
the single-bot path; the multi-bot crew launcher needs tmux (Mac/Linux, or
WSL on Windows).

### 1. This repository

```bash
git clone https://github.com/bitsofchris/augi-craft.git
cd augi-craft
npm ci
npm run setup:26.3     # native Minecraft 26.3 data for the pinned Mineflayer fork
npm test               # no Minecraft needed
npm run init           # makes ~/.augi-craft with a config and an example crew
```

The pinned Mineflayer fork and three of its dependencies come from GitHub by
commit, not from the npm registry. npm 12 refuses those by default
(`EALLOWGIT`); the `.npmrc` here allows them for this project.

`npm run init -- /some/other/path` puts the instance elsewhere; then
`export AUGI_HOME=/some/other/path` in your shell (and in any MCP config that
should use it). Edit `$AUGI_HOME/crew.json` when you run a crew (§4): your players' names
and your server's port. A single bot (§3) reads its connection from the
environment instead.

### 2. A Minecraft server

The bots join like any player, so they need a server on your machine. Pick one:

**A. Singleplayer + Open to LAN (simplest).** Create a Survival world
(Peaceful for the first test), press `Esc`, **Open to LAN**, cheats off. Chat
prints a port such as `Local game hosted on port 54321`. Pass that port as
`MC_PORT` when you start your agent (§3); it changes every time you open to
LAN. A LAN world has no console and no whitelist: the bots just join.

**B. A local dedicated server (steadier; the bots play with nobody logged in).**
Download the matching `server.jar` from minecraft.net (or
[Paper](https://papermc.io)), run `java -jar server.jar nogui` once, accept
`eula.txt`, then in `server.properties` set `online-mode=false`,
`gamemode=survival`, `difficulty=peaceful` and start it again. Port 25565.
Keep it in `$AUGI_HOME/server/` or anywhere outside this repository.

> `online-mode=false` lets bots join without a Microsoft account. Keep the
> server on your home network; never expose an offline-mode server to the
> internet. To join an online-mode server set `MC_AUTH=microsoft` and use a
> real account.

A dedicated server with `white-list=true` needs each bot name added once in
its console (`whitelist add Augi`).
**Console and tablet players** (Xbox, Switch, iPad) can join a Java server
through [Geyser](https://geysermc.org) and Floodgate; their names then start
with a dot (`.Player1` in `crew.json`).

**Minecraft Java 26.3** is the supported version: the pinned Mineflayer fork
was verified live on it, and every config here sets `MC_VERSION=26.3`. Another
version may connect with `MC_VERSION` unset (auto-detect) but is untested.

### 3. Connect an agent

**Claude Code (any OS).** `.mcp.json` in this repo registers the `augi-craft`
server and takes `MC_PORT`, `MC_HOST`, `MC_USERNAME`, `MC_AUTH` and
`MC_VERSION` from your shell, so nothing tracked needs editing:

```bash
MC_PORT=54321 MCP_TOOL_TIMEOUT=300000 claude   # the timeout keeps long actions alive
```

Approve the server, then:

```
/play make starter tools
```

The `/play` command (`.claude/commands/play.md`) runs the learning loop: read
the map, write one program per subgoal, verify, save what worked, write an
episode. Talk to the bot in game chat; it sees you in the next result's
`inbox`.

**Codex CLI.** Add to `~/.codex/config.toml`:

```toml
[mcp_servers.augi-craft]
command = "node"
args = ["/absolute/path/to/augi-craft/runtime/mcp/server.js"]
env = { MC_HOST = "127.0.0.1", MC_PORT = "25565", MC_USERNAME = "Augi", MC_VERSION = "26.3" }
tool_timeout_sec = 300
```

Codex has no `/play` command. It reads `AGENTS.md`, which points it to the
play protocol; start it from a goal:

> Play Minecraft: call `kb_map`, follow the protocol it returns, and make
> starter tools.

The server inherits `AUGI_HOME` from your environment; add it to `env` if it
is not the default. The crew launcher's `model` in `crew.json` (`gpt-6.1-sol`
in the example) is only an example: use any model `codex --model` accepts on
your account.

**Any MCP client** can run `node runtime/mcp/server.js` over stdio.

### 4. A crew (optional)

Several bots at once, each its own agent and character, sharing one knowledge
base: [docs/STARTUP_GUIDE.md](docs/STARTUP_GUIDE.md). Roles live in
`agents/crew/` (gatherer, hunter, builder, guard, bodyguard, diamond miner,
general agents). On Mac/Linux with tmux and Codex CLI:

```bash
scripts/start-crew.sh guard diamond agent1 agent2
```

### 5. Voice orders (optional)

A page on a tablet where a kid holds a bot's button and talks; a local Whisper
model transcribes and the order lands in game chat: [docs/VOICE.md](docs/VOICE.md).
The default transcriber is macOS only; set `VOICE_STT_CMD` on Linux or Windows.

## Try it without an LLM

`MC_PORT=<port> npm run demo` runs the scripted starter-tools program. Full
walkthrough: [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md).

## For agents setting this up

Paste this into Claude Code or Codex in the cloned repository:

> Set up augi-craft on this machine: run `npm ci`, `npm run setup:26.3`,
> `npm test` and `npm run init`. Then read README.md and docs/INSTANCE.md
> and help me connect one bot. I will open a world to LAN myself and give
> you the port; if we use a dedicated server instead, download the Minecraft
> Java 26.3 server jar, accept the EULA after its first run, and edit
> server.properties as README §2 says.

The agent cannot open the Minecraft client: Open to LAN is always the
human's step.

## How the learning works

- **Programs, not steps.** The agent writes one `run_program` per subgoal; the
  program loops and reacts on its own ([docs/PROGRAMS.md](docs/PROGRAMS.md)).
- **Helpers.** Code that worked is saved with `save_helper` and called as
  `helpers.<name>()` by every bot in that role.
- **Skills and lessons.** `kb_save_skill` records what holds in any world;
  `kb_promote` moves a skill to validated after verified successes, and refuses
  anything that names a person or a coordinate (those belong in world state,
  [docs/WORLD_STATE.md](docs/WORLD_STATE.md)).
- **Episodes.** Every attempted task gets an honest record, cited as evidence.
- **A fresh agent.** Watch one learn from nothing in its own instance:
  [docs/FRESH_AGENT.md](docs/FRESH_AGENT.md).

## Sharing what your bots learned

Validated skills and helpers are meant to hold in any world, so they can
be shared: copy `$AUGI_HOME/knowledge/learned/validated/*.md` into this
repo's `knowledge/learned/validated/` and open a pull request (a helper
that is still a candidate goes in `candidates/`). In each file's `evidence`
list, cut every episode id down to its date and time: the rest of the id is
built from an order's text and can name a player. The publish check and the
tests look for coordinates, home paths and the names in your `crew.json`;
read each file yourself as well before you share it.

## Security

A bot's programs run on your computer with the same access as the AI
assistant that wrote them; they are not sandboxed
([docs/PROGRAMS.md](docs/PROGRAMS.md)). Anyone who can chat on your Minecraft
server can give a bot orders, so treat chat access as access to that
computer: keep the server on your home network, use a whitelist on a
dedicated server, and never expose it to the internet.

## License

MIT. Third-party notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
