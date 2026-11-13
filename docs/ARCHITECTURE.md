# Architecture

```
Claude Code / Codex  ──MCP(stdio)──►  runtime/mcp/server.js → augi.js
                                          │
           run_program ─► runtime/program  (vm context, lib, helpers, guards, jobs)
                               │
                          BotSession.run   (lock · timeout · stop · diffs · inbox)
                               │
                          Mineflayer bot   ◄── self-defense reflex
                                          │
           kb_* tools ───► KnowledgeStore  (Markdown + YAML, Git, cross-process lock)
```

| Area | Code | Doc |
|---|---|---|
| Program loop | `runtime/program/` | [PROGRAMS.md](PROGRAMS.md) |
| Action library (`lib`) | `runtime/tools/` | [CAPABILITY_DEVELOPMENT.md](CAPABILITY_DEVELOPMENT.md) |
| Bot session and reflex | `runtime/bot/` | [SELF_DEFENSE.md](SELF_DEFENSE.md) |
| Instance directory (`AUGI_HOME`) | `runtime/home.js`, `scripts/init-home.mjs` | [INSTANCE.md](INSTANCE.md) |
| Publish check | `scripts/check-publish.mjs`, `.githooks/`, `.github/workflows/ci.yml` | [PUBLISHING.md](PUBLISHING.md) |
| Knowledge base | `runtime/memory/`, `knowledge/` (seeds, protocol, starter pack) | [knowledge/core/AGENTS.md](../knowledge/core/AGENTS.md) |
| World state (per world) | `knowledge/worlds/<world>/`, `AUGI_WORLD` | [WORLD_STATE.md](WORLD_STATE.md) |
| Worker crew | `agents/crew/`, `scripts/start-crew.sh` | [WORKER_CREW.md](WORKER_CREW.md) |
| Fresh-agent experiment (film it learning) | `scripts/fresh-kb.sh`, `templates/fresh-kb/` | [FRESH_AGENT.md](FRESH_AGENT.md) |
| Voice commands (optional) | `runtime/voice/`, `scripts/start-voice.sh` | [VOICE.md](VOICE.md) |
| Replay recording (optional) | `runtime/recording/`, `AUGI_RECORD` | [RECORDING.md](RECORDING.md) |
| Server and crew startup | `scripts/start-crew.sh`, `scripts/crew-field.mjs` | [STARTUP_GUIDE.md](STARTUP_GUIDE.md) |
| lib action notes | | [DIG_TUNNEL.md](DIG_TUNNEL.md), [BODYGUARD.md](BODYGUARD.md), [FISHING_AND_CAMPFIRE.md](FISHING_AND_CAMPFIRE.md), [FARMING.md](FARMING.md), [RETURN_TO_BASE.md](RETURN_TO_BASE.md) |
| Manual check | | [SMOKE_TEST.md](SMOKE_TEST.md) |

