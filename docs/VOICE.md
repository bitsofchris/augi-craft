# Voice commands

**Name:** hold-to-talk voice service

**Description:** a page on a tablet or phone where a player holds a bot's
button and speaks. The order is transcribed on this computer with a local Whisper
model and posted to game chat for that bot; bot replies show on the page and
can be read aloud.

**When to use:** a player (often a kid on a console or tablet) wants to give the bots
orders without typing. It is optional: the crew works the same without it.

## How it works

```
tablet page ──WAV──► runtime/voice/server.js ──► transcribe.js (mw / whisper)
   ▲                                            │
   └── replies (SSE) ◄── relay.js "AugiEars" ◄──┴─► game chat:
                                                   [voice] .Player1: DiamondMiner, get me diamonds
                                                        │
                    BotSession (each worker) ◄──────────┘ sees chat from .Player1, via: 'voice'
```

- **Page** (`runtime/voice/page.html`): one big button per worker in
  `crew.json` plus "everyone". Holding records microphone PCM, releasing
  uploads a 16 kHz mono WAV (15 s cap). The target is the button, not the
  spoken words, because Whisper mishears bot names ("Aji Diamond").
- **Transcription** (`transcribe.js`): by default runs MacWhisper's
  `mw transcribe` (macOS only) with the local
  `whisper-cpp:ggml-model-whisper-base` model, about 0.7 s per order. On
  Linux or Windows, or to use another tool, set `VOICE_STT_CMD`, e.g.
  `whisper-cli -m ggml-base.en.bin -nt -np -f {file}`.
- **Relay** (`relay.js`): the `AugiEars` character posts
  `[voice] <player>: <bot>, <order>` and reconnects on its own. It refuses
  anything starting with `/`.
- **Workers** (`runtime/bot/session.js`): a line in that format from the
  relay character becomes chat from `<player>` with `via: 'voice'`, so "me"
  means the speaking player and `wait_for_chat { names }` wakes the right bot.
  The relay name is `AUGI_VOICE_RELAY` (default `AugiEars`).
- **No cursing** (`runtime/bot/no-cursing.js`): an order, spoken or typed,
  to say, type or tell a curse word never reaches the agent. The bot it
  names (or every bot, for "everyone" or no name) replies with a fixed
  refusal; the others drop it. It is a hard rule in the runtime, so a model
  cannot be talked out of it. It does not filter what a bot says on its own.

- **Saving recordings** (optional): the page's "Save recordings (for a
  video)" toggle, remembered per tablet, sends each order with `save=1`. The
  server then keeps the 16 kHz WAV in
  `$AUGI_HOME/voice/recordings/<date>/<hhmmss>-<player>-to-<bot>.wav` (local
  time, to match screen-recording timestamps) and appends
  `{ at, player, target, text, file }` to `$AUGI_HOME/voice/recordings/index.jsonl`.
  Misheard or empty orders are saved too. With the toggle off, nothing is
  kept: the upload is deleted after transcription. `$AUGI_HOME/voice/` is outside
  the repository, so recordings never leave this machine unless copied by hand.

## Run it

Settings live in the `voice` section of `$AUGI_HOME/crew.json` (relay name,
port, players who may speak; the first is the page default).

```bash
./scripts/start-voice.sh
```

The first run makes a self-signed certificate in `$AUGI_HOME/voice/` (outside
the repository), because browsers only allow the microphone over https. The script prints
the tablet address, `https://<your-ip>:8443`. On the tablet, open it, accept the
certificate warning once, tap **Tap to start**, and allow the microphone.
The same port also answers plain http with a redirect to https, so typing
the address without `https://` works. The service log (`tmux attach -t
augi-voice`) prints every address the page is reachable at and each device
that connects; if a phone never shows up there, it is not reaching this computer
(different Wi-Fi, guest network, or cellular data).
Restart the script after the machine's LAN address changes (delete `$AUGI_HOME/voice/`
first to remake the certificate).

The relay character must be whitelisted once: `whitelist add AugiEars` in the
server console. Stop the service with `tmux kill-session -t augi-voice`.

## Limits

- Anyone on the home network can open the page; only players listed in
  `crew.json` can be spoken as.
- Transcripts can be wrong. Workers should treat `via: 'voice'` orders as
  possibly misheard and ask one short question when unsure.
- The relay is a real player entity standing where it joined; mobs can kill
  it, and it respawns.
- Tests: `test/voice.test.js` (format, session mapping, transcriber, server,
  relay). The browser recording path is checked by hand.
