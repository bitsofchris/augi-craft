# augi-craft

Minecraft agent runtime (Mineflayer) + Git-backed Markdown knowledge base, exposed via the `augi-craft` MCP server (`.mcp.json`). Map of code and docs: `docs/ARCHITECTURE.md`. This repository is public and holds only the app; everything personal (crew, players, learned knowledge, worlds) lives in the instance directory `AUGI_HOME` (`docs/INSTANCE.md`), and `npm run check:publish` plus a pre-commit hook keep it that way (`docs/PUBLISHING.md`).

## First run (before any play)

1. `npm ci`, `npm run setup:26.3`, `npm test`, `npm run init` (README §1).
2. You cannot open Minecraft. Ask the human to open a Java 26.3 world to LAN and read you the port, or to run a dedicated server on 25565 (README §2).
3. The MCP server reads `MC_PORT` and `MC_USERNAME` once, when the CLI starts. If `observe` returns `not_connected`, ask the human to restart the CLI with `MC_PORT=<port>` (Claude Code) or to fix `env` in `~/.codex/config.toml` (Codex). Do not edit `.mcp.json`.
4. In a new world nothing is saved yet. Choose a base, place a chest, and save `base` and `base_chest` with `lib.save_location` before using helpers that deliver to base (`docs/WORLD_STATE.md`).

## Two different jobs

- **Playing Minecraft** (when asked to play, gather, craft, etc.): use the `augi-craft` MCP tools. Start with `kb_map` and follow `knowledge/core/AGENTS.md`. Play by writing programs with `run_program`: one program per subgoal that loops and reacts on its own, calling `lib.*` actions, saved `helpers.*`, or raw Mineflayer. Save code that worked with `save_helper` and lessons with `kb_save_skill`. In Claude Code, `/play <goal>` does this.
- **Developing the runtime**: code in `runtime/`, tests in `test/` (`npm test`, no Minecraft needed). The program loop is in `runtime/program/` (`docs/PROGRAMS.md`); lib actions are in `runtime/tools/` (`docs/CAPABILITY_DEVELOPMENT.md`).

## Operator rules (watching or developing the crew)

The agents learn by planning and reasoning; the operator (you, Claude) keeps
the harness working. Do not do their learning for them.

- **No whack-a-mole.** When a bot fails at an order, do not patch its helper,
  its role file or `AGENTS.md` with a rule for that case (an if-else for snow,
  a detour for one ore, a table row that maps an order to one helper). Fix
  the runtime when the runtime is wrong (a crash, a lost connection, a guard
  that breaks), with tests; otherwise let the agent plan, fail, and record
  the episode and lesson itself.
- **Do not write agent helpers or lessons yourself** unless the user asks.
  Fixing an outright bug in an existing helper (it crashes, it throws away
  items) is fine; say so in the commit.
- **Lessons are general, world facts are world state.** A lesson must hold
  in any world. Coordinates, chests, mines and the base belong in
  `knowledge/worlds/<world>/` (`docs/WORLD_STATE.md`), never in a skill.
- **Judge behaviour in a fair test.** Before changing anything because a test
  agent did badly, check the test matches real play (same kind of world,
  starting kit, model and world state). Compare against the previous code
  in the same test.
- **Token work removes waste, not reasoning.** Polling, short waits and
  bulky results are waste; planning and deciding are not.

## Conventions

- ESM, Node >= 22, no build step, `node:test` for tests.
- Every tool returns `{ ok, tool, summary, error: {category, message}, changes: {inventory, position}, observations, durationMs }` via `BotSession.run`, plus `inbox` when chat or events are pending.
- Seed packs (`knowledge/seeds/`) are read-only for the agent; learned knowledge and helper programs live in `$AUGI_HOME/knowledge/learned/`. This repo's `knowledge/learned/` is the starter pack copied into a new instance (`docs/INSTANCE.md`): world-agnostic skills and helpers only, validated ones in `validated/`, unproven ones in `candidates/`.
- Never put a person's name, a coordinate or a home-directory path in code, docs, role files or skills; those belong in the instance (`crew.json`, `knowledge/worlds/`).
