# The instance directory (AUGI_HOME)

**Name:** instance directory

**Description:** one folder, named by `AUGI_HOME`, holds everything personal
to an installation: the crew and its players, the knowledge the bots learn,
saved places per world, voice recordings and replays. The repository holds
only the app. Nothing a bot writes ever lands in the repository.

**When to use:** always. `npm run init` makes the default instance at
`~/.augi-craft`; set `AUGI_HOME` to put it elsewhere, for example in a
private Git repository of your own.

## How it works

```
$AUGI_HOME/
  augi.config.json          knowledge config: seed packs, promotion rule, self-defense
  crew.json                 workers, their players, server connection, voice settings
  codex.extra               optional: extra Codex flags, one per line, for the crew launcher
  knowledge/
    core/MAP.md             generated index (kb_rebuild_map)
    core/AGENTS.md          optional: your own protocol; otherwise the app's is used
    seeds/                  optional: your own seed packs; otherwise the app's
    learned/candidates/     skills and helpers the bots wrote
    learned/validated/      promoted ones (shareable: no names, no coordinates)
    learned/.starter-pack.json  written once the starter pack has been copied in
    learned/deprecated/, learned/evidence/
    episodes/               one record per attempted task
    worlds/<world>/         locations.json, world.json, sightings.json
    TIMELINE.md             optional running log (config timeline: true)
  voice/                    certificate and saved voice orders (optional)
  recordings/               replay files (AUGI_RECORD=1)
  server/                   a good place for the Minecraft server (not read by the runtime)
```

**The starter pack.** The first time an instance is used (`npm run init`, or
the MCP server's first start), the skills and helpers in this repository's
`knowledge/learned/validated/` and `candidates/` are copied into it: what one
family's bots learned over a few weeks, with everything world-specific
removed. From then on they are yours: your bots revise, promote and deprecate
them like anything else they learn, and updating this repository never
overwrites them. A skill you delete stays deleted. To start with nothing
learned, create `knowledge/learned/.starter-pack.json` before the first run
(`scripts/fresh-kb.sh` does this); to copy the pack in again, delete that
file.

- `runtime/home.js` derives every path from `AUGI_HOME`. `AUGI_KNOWLEDGE_DIR`,
  `AUGI_CONFIG`, `AUGI_CREW_FILE` and `AUGI_RECORD_DIR` still override single
  paths (tests and experiments use them) and resolve relative to the instance.
- **Layering.** `KnowledgeStore` reads `core/` and `seeds/` from the instance
  when it has them, else from this repo's `knowledge/`. Writes always go to
  the instance. So an instance starts as an empty folder and the bots have
  the full protocol and seed skills on their first `kb_map`.
- **The crew file** names the bots (so they are never mistaken for players),
  the person each role serves (`player`), the people who may speak on the voice
  page (`voice.players`) and the world whose saved places to use (`world`,
  overridden by `AUGI_WORLD`). Without one, `agents/crew/crew.example.json`
  stands in.
- **Private names.** The people in `crew.json` (`voice.players`, `people`,
  workers' `player`) are the names `kb_promote` refuses in a skill and the
  publish check greps the repository for.
- The MCP server, the voice service and every script read `AUGI_HOME` from
  the environment. The crew launcher passes it to each worker.

## Set it up

```bash
npm run init                      # ~/.augi-craft
npm run init -- ~/my-augi         # elsewhere; then export AUGI_HOME=~/my-augi
```

`init` never overwrites. It copies `templates/home/augi.config.json` and the
example crew, builds `knowledge/core/MAP.md`, and runs `git init` so the
bots' knowledge has history (`kb_commit` or `autoCommit: true` commit there).

An existing knowledge folder from before the split works unchanged: point
`AUGI_HOME` at the folder that contains `knowledge/`, add a `crew.json`
beside it, and keep the server and voice folders wherever they were (set
`AUGI_RECORD_DIR` if replays should stay in their old place).

## Rules

- A coordinate, a chest, a player's name or "where the farm is" is instance
  state. It goes in `worlds/<world>/` or `crew.json`, never in a skill or a
  role file ([WORLD_STATE.md](WORLD_STATE.md)).
- Role files in `agents/crew/` are shared text: they say "your player", and
  the launcher fills in the name from `crew.json`.
- Do not point `AUGI_HOME` inside this repository. The `.gitignore` catches
  the common folders if you do, and the publish check catches the rest.
