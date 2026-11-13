#!/bin/bash
# Optional voice service: hold-to-talk page for players (docs/VOICE.md).
# Runs in tmux session augi-voice. Stop: tmux kill-session -t augi-voice
# The certificate and saved orders live in $AUGI_HOME/voice.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMUX="$(command -v tmux || true)"
[[ -n "$TMUX" ]] || { echo "tmux is required (or run: node runtime/voice/main.js)" >&2; exit 2; }
SESSION=augi-voice
CERTS="$(node "$ROOT/scripts/crew-field.mjs" home)/voice"
if [[ ! -f "$CERTS/key.pem" ]]; then
 # Browsers only allow the microphone over https (except on localhost), so
 # make a self-signed certificate for this machine's name and LAN address once.
 mkdir -p "$CERTS"
 # Every IPv4 address of this machine (Wi-Fi and wired can both be on the LAN).
 if command -v ifconfig >/dev/null; then IPS="$(ifconfig | awk '/inet / && $2 != "127.0.0.1" {printf ",IP:%s", $2}')"
 else IPS="$(hostname -I 2>/dev/null | tr ' ' '\n' | awk 'NF {printf ",IP:%s", $1}')"; fi
 openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=augi-voice" \
  -addext "subjectAltName=DNS:localhost,DNS:$(hostname),IP:127.0.0.1$IPS" \
  -keyout "$CERTS/key.pem" -out "$CERTS/cert.pem" 2>/dev/null
 echo "Made a certificate in $CERTS for${IPS//,IP:/ }"
fi
if "$TMUX" has-session -t "$SESSION" 2>/dev/null; then
 echo "Voice service already running. Attach: tmux attach -t $SESSION"
 exit 0
fi
ENV_PREFIX="env"
for v in $(compgen -v | grep '^AUGI_' || true); do ENV_PREFIX+=" $v=$(printf %q "${!v}")"; done
"$TMUX" new-session -d -s "$SESSION" -c "$ROOT" "$ENV_PREFIX node runtime/voice/main.js"
"$TMUX" set-option -t "$SESSION" remain-on-exit on
sleep 2
"$TMUX" capture-pane -p -t "$SESSION" | grep -v '^$' || true
echo "Logs: tmux attach -t $SESSION"
