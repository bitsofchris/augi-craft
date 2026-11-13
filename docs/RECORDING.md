# Recording agents for replays

**Name:** agent replay recorder (`AUGI_RECORD`)

**Description:** each agent saves everything it sees as a ReplayMod replay
(`.mcpr`), with markers at the interesting moments, so a session can be
replayed later with a free camera, filmed with the screen recorder, or
rendered as a time-lapse. Nobody has to film live.

**When to use:** any play session worth filming. Turn it on when launching
the crew; the files land in `$AUGI_HOME/recordings`.

## How it works

- `runtime/recording/replay-recorder.js` taps the raw packets the bot's
  connection receives (every protocol state, from login success on) and writes
  them with millisecond timestamps in ReplayMod's format: a zip with
  `recording.tmcpr`, `metaData.json` (format version 14, protocol 777 for
  26.3), `markers.json` and `recording.tmcpr.crc32`
  (`runtime/recording/zip.js`).
- The server never sends a player its own body, so the recorder adds the
  agent's spawn packet and its position and head direction every tick, as
  ReplayMod's own recorder does. Arm swings and held items are not added yet.
- Markers are added automatically for chat orders from players, `set_task`,
  finished jobs and deaths. Agents can add their own with the `mark_moment`
  tool ("roof finished").
- The file is finished when the bot disconnects or its MCP server stops
  (Codex closing it, Ctrl-C, SIGTERM). Next to each `.mcpr` is a
  `.markers.txt` shot list: `m:ss  what happened`.

```bash
AUGI_RECORD=1 scripts/start-crew.sh agent1 agent2 agent3 agent4
```

(`agents/crew/start-worker.sh` passes `AUGI_RECORD` to each worker; the
folder is `$AUGI_HOME/recordings` unless `AUGI_RECORD_DIR` says otherwise.)

## Watching a replay

One-time setup (macOS paths shown; on Windows the folder is `%APPDATA%\.minecraft`): Fabric Loader 0.19.5 for 26.3
(launcher profile **fabric-loader-26.3**) and ReplayMod 26.3-2.6.28 in
`~/Library/Application Support/minecraft/mods/`. The normal 26.3 profile is
unchanged.

1. Copy the `.mcpr` into `~/Library/Application Support/minecraft/replay_recordings/`.
2. Launcher: profile **fabric-loader-26.3**, Play. Main menu: **Replay Viewer**,
   pick the file, **Load**.
3. Free camera with WASD and the mouse; the timeline at the top shows the
   markers. Speed up the replay for a time-lapse, or add camera keyframes and
   **Render** to a video file.

## Size

Measured on 2026-10-21: joining costs about 3 MB (the terrain around the
agent, compressed), then about 12 KB/s while playing, roughly 44 MB per agent
per hour plus more terrain as the agent travels.

## Limits

- An agent records what the server sends it: about `view-distance` (8 chunks,
  ~128 blocks) around itself.
- Arm swings, held items and the agent's own block-breaking animation are not
  in its own recording yet (other players' are).
- Checked with tests (`test/recording.test.js`) and a live recording that
  re-parses packet by packet with the 26.3 protocol; viewing in ReplayMod is
  the final check.
