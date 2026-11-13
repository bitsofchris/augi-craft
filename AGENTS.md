# augi-craft

Minecraft agent runtime (Mineflayer) + Git-backed Markdown knowledge base, exposed via the `augi-craft` MCP server (`.mcp.json`). Map of code and docs: `docs/ARCHITECTURE.md`. This repository is public and holds only the app; everything personal (crew, players, learned knowledge, worlds) lives in the instance directory `AUGI_HOME` (`docs/INSTANCE.md`), and `npm run check:publish` plus a pre-commit hook keep it that way (`docs/PUBLISHING.md`).

## First run (before any play)

1. `npm ci`, `npm run setup:26.3`, `npm test`, `npm run init` (README §1).
2. You cannot open Minecraft. Ask the human to open a Java 26.3 world to LAN and read you the port, or to run a dedicated server on 25565 (README §2).
3. The MCP server reads `MC_PORT` and `MC_USERNAME` once, when the CLI starts. If `observe` returns `not_connected`, ask the human to restart the CLI with `MC_PORT=<port>` (Claude Code) or to fix `env` in `~/.codex/config.toml` (Codex). Do not edit `.mcp.json`.
4. In a new world nothing is saved yet. Choose a base, place a chest, and save `base` and `base_chest` with `lib.save_location` before using helpers that deliver to base (`docs/WORLD_STATE.md`).

## Two different jobs

- **Playing Minecraft** (when asked to play, gather, craft, etc.): use the `augi-craft` MCP tools. Start with `kb_map` and follow `knowledge/core/AGENTS.md`. Play by writing programs with `run_program`: one program per subgoal that loops and reacts on its own, calling `lib.*` actions, saved `helpers.*`, or raw Mineflayer. Save code that worked with `save_helper` and lessons with `kb_save_skill`. In Claude Code, `/play <goal>` does this; in Codex or any other client, start from the goal: call `kb_map` first and follow the protocol it returns.
- **Developing the runtime**: code in `runtime/`, tests in `test/` (`npm test`, no Minecraft needed). The program loop is in `runtime/program/` (`docs/PROGRAMS.md`); lib actions are in `runtime/tools/` (`docs/CAPABILITY_DEVELOPMENT.md`).

## Conventions

- ESM, Node >= 22, no build step, `node:test` for tests.
- Every tool returns `{ ok, tool, summary, error: {category, message}, changes: {inventory, position}, observations, durationMs }` via `BotSession.run`, plus `inbox` when chat or events are pending.
- Seed packs (`knowledge/seeds/`) are read-only for the agent; learned knowledge and helper programs live in `$AUGI_HOME/knowledge/learned/`. This repo's `knowledge/learned/` is the starter pack copied into a new instance (`docs/INSTANCE.md`): world-agnostic skills and helpers only, validated ones in `validated/`, unproven ones in `candidates/`.
- Never put a person's name, a coordinate or a home-directory path in code, docs, role files or skills; those belong in the instance (`crew.json`, `knowledge/worlds/`).
