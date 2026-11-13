# Fresh agent

**Name:** fresh-agent experiment

**Description:** one bot with the learning loop but no Minecraft skills: an
empty knowledge base, no seed packs, and no `lib` game actions. It writes its
own helpers against raw Mineflayer, and every helper, lesson and episode lands
in a live `TIMELINE.md` you can watch in Obsidian next to the game.

**When to use:** measuring how fast the learning loop alone learns, or
showing skill acquisition from scratch (a bot with no skills working its way
to a diamond).

## How it works

- **Config** (`augi.config.json` in the new directory): `packs: []`,
  `lib: []` (programs get `bot`, `goals`, `Vec3`, `helpers` and `lib.on`
  only), `timeline: true`, `autoCommit: true` (every save is a git commit, so
  `git log` is a second timeline).
- **Protocol:** `templates/fresh-kb/core/AGENTS.md`, the normal learning loop
  without the player-request cheat sheet or any `lib`/helper names.
- **Isolation:** the agent runs from the new directory with
  `--strict-mcp-config` (only its own augi-craft server), `--tools ""` (no
  built-in tools: no shell, file, web, agent or workflow tools) and
  `--allowedTools "mcp__augi-craft"` (its own tools run without prompts). It
  sees that directory's `CLAUDE.md` and `/play`, and cannot read this repo's
  code, docs or knowledge.
- **Kept:** `run_program` and jobs, `save_helper`, the kb tools, `observe`,
  `say`, chat, timeouts, stop, guards and the 26.3 protocol fixes.

## Run it

1. Start a new peaceful world (new seed) and whitelist the bot name.
2. `scripts/fresh-kb.sh ~/augi-fresh-kb AgentMiner` (refuses an existing dir).
3. Open `~/augi-fresh-kb/knowledge` as an Obsidian vault; pin `TIMELINE.md`.
4. Optional, to watch or record: join as `Operator`, `/gamemode spectator`,
   and start your screen recorder.
5. Start the agent (the prompt goes first: the flags after it take several
   values and would swallow it):

   ```bash
   cd ~/augi-fresh-kb && claude "/play get me a diamond" --tools "" --allowedTools "mcp__augi-craft" --strict-mcp-config --mcp-config mcp.json
   ```

   On the first launch Claude Code asks whether to trust the folder, and the
   prompt runs before the MCP server finishes connecting, so the agent says
   its tools are missing. Type `/play get me a diamond` again; later launches
   are fine. Once the bot joins, `/spectate AgentMiner` (it must be online),
   F5 for over the shoulder, F1. Spectators cannot pick up items it gives
   you; switch to `/gamemode survival` first.
6. Do a 20-minute trial first. For the second run, start a new world with the
   same knowledge directory and compare time to diamond.

## Limits

- The model already knows Minecraft facts; only the skills start empty.
- No eating helper: on peaceful hunger does not fall, so this is not needed.
- `--tools ""` turns off every built-in tool. A `--disallowedTools` list
  does not: it leaves tools such as `Monitor` (runs shell commands),
  `Workflow` and `NotebookEdit`.
- User-level settings still load, including `~/.claude/CLAUDE.md` and hooks.
