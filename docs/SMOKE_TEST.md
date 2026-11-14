# Manual Minecraft smoke test

This test exercises the first end-to-end demonstration against a real server.
Allow about 10 minutes.

## 0. Prerequisites

- `npm ci && npm run setup:26.3 && npm test` passes.
- A Survival world on Java 26.3 is reachable (see README §2). Use **Peaceful**
  difficulty and spawn near trees. If needed, walk your own player to a forest.
- Note the port and export it: `export MC_PORT=<port> MC_VERSION=26.3`.
- Run `npm run init` once so the instance folder exists (default `~/.augi-craft`).

## Part A — scripted run (no LLM)

```bash
MC_PORT=$MC_PORT npm run demo
```

Expected output (abridged):

```
Retrieving skills before acting:
  - acquire-starter-tools (seed): ...
✔ observe {} -> At 12, 70, -3; health 20, food 20; empty inventory
✔ find_blocks {"block":"log","maxDistance":64} -> Found 5 log block(s); nearest oak_log at (15, 70, -1)
✔ gather_blocks {"block":"log","count":4} -> Collected 4 oak_log  [oak_log +4]
✔ craft_item {"item":"oak_planks","count":16} -> Crafted 16 oak_planks  [oak_log -4, oak_planks +16]
✔ craft_item {"item":"stick","count":4} -> Crafted 4 stick  [oak_planks -2, stick +4]
✔ craft_item {"item":"crafting_table"} -> Crafted 1 crafting_table  [oak_planks -4, crafting_table +1]
✔ craft_item {"item":"wooden_pickaxe"} -> Crafted 1 wooden_pickaxe  [crafting_table -1, oak_planks -3, stick -2, wooden_pickaxe +1]
✔ craft_item {"item":"wooden_axe"} -> Crafted 1 wooden_axe  [...]
Verification: PASS (wooden_pickaxe 0 -> 1; wooden_axe 0 -> 1)
Episode: episodes/2026-...-starter-tools-from-nothing-scripted-demo.md
Lesson: learned/candidates/four-log-starter-kit.md
```

Check each demonstration requirement:

| # | Requirement | Where to look |
|---|---|---|
| 1 | Observe current state | first `observe` line |
| 2 | Locate nearby logs | `find_blocks` line |
| 3 | Collect ≥ 4 logs | `gather_blocks` shows `oak_log +4` (or another species) |
| 4 | Craft planks and sticks | the two `craft_item` lines |
| 5 | Starter tools | `wooden_pickaxe +1` (axe if planks allowed) |
| 6 | Verify inventory | `Verification: PASS` line, computed from real inventory |
| 7 | Episode + lesson | new files in `$AUGI_HOME/knowledge/episodes/` and `$AUGI_HOME/knowledge/learned/candidates/` |
| 8 | Retrieve after restart | Part C |

In game, you should see the bot walk to a tree, chop it, and place a crafting table.

## Part B — agent run (Claude Code or Codex)

Remove the scripted lesson so the agent has to write its own:
delete the new files under `$AUGI_HOME/knowledge/episodes/` and
`$AUGI_HOME/knowledge/learned/candidates/`.

Give the agent a fresh crafting challenge (e.g. drop its tools with `/clear Augi` from
your own operator account), then:

- Claude Code: `MCP_TOOL_TIMEOUT=300000 claude` → `/play make a wooden pickaxe and axe`
- Codex: `codex "Use the augi-craft MCP tools. Call kb_map, follow its protocol, and make a wooden pickaxe and axe."`

Watch for the loop: `kb_map` → `observe` → `kb_search` / `list_helpers` → one
`run_program` per subgoal (calling `lib.*` and looping inside the program) → a
verification statement citing `changes.inventory` → `kb_write_episode` →
`save_helper` / `kb_record_outcome` / `kb_save_skill` → `kb_rebuild_map`.

The demo in Part A runs each lib action as its own one-line program, so its
output lines name lib actions (`find_blocks`, `gather_blocks`, `craft_item`).

Also test these:
- **Stop**: during a long background program, ask the agent to stop. Expect
  `stop_action`, then `job_status` shows the job `failed` with `interrupted`.
- **Instructions in chat**: type `Augi, collect 3 dirt` in game chat. The agent should
  see it in the next result's `inbox`.
- **Failure feedback**: ask for a `stone_pickaxe` with no cobblestone. Expect
  `missing_materials` with `observations.missing`, and a revised plan (gather stone).

## Part C — restart and retrieve the lesson

1. Fully quit the CLI (this also stops the MCP server and the bot).
2. Start a new session and ask: *"What do you know about getting starter tools? Search
   your knowledge base first."*
3. Expect `kb_search` to return `four-log-starter-kit` (or the agent's own lesson) and
   `acquire-starter-tools`. `kb_get` shows the evidence entry with the episode id.

Without an LLM: `npm run kb -- search "starter kit"` and `npm run kb -- episodes`.

## Part D — promotion (optional)

Run the demo again in a fresh area, or have the agent repeat the task. After a second
verified success from a different episode, `kb_promote {id: "four-log-starter-kit"}`
moves the lesson to `learned/validated/`. Commit with `kb_commit` (or `git`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `not_connected` / ECONNREFUSED | Wrong port. The LAN port changes on each Open to LAN. |
| Kicked: "Failed to verify username" | The server is online-mode. Use `online-mode=false` or `MC_AUTH=microsoft`. |
| Version errors | Set `MC_VERSION=26.3` explicitly and run `npm run setup:26.3` after `npm ci`. |
| `npm ci` fails with `EALLOWGIT` | npm 12 refusing the Git dependencies. The repo's `.npmrc` (`allow-git=all`) allows them; if it is missing or overridden, run `npm ci --allow-git=all`. |
| `lib.gather_blocks` → `not_found` | No trees within 64 blocks. Move the bot (`lib.navigate_to` x/y/z) or move your spawn. |
| Tool times out in the CLI but works in the demo | Raise `MCP_TOOL_TIMEOUT` (Claude Code) or `tool_timeout_sec` (Codex). |
