#!/bin/bash
# Restart one crew worker in its tmux session without leaving a second
# controller behind. Killing a Codex pane can orphan its augi-craft MCP server,
# which keeps logging in as the same character and kicks the new one
# ("You logged in from another location").
#   scripts/restart-worker.sh <role-or-username>     (AUGI_TMUX_SESSION, default augi-crew)
set -euo pipefail
# tmux panes get the tmux server's environment, not this shell's: pass the
# AUGI_* settings (AUGI_HOME, AUGI_RECORD, AUGI_WORLD, ...) through explicitly.
ENV_PREFIX="env"
for v in $(compgen -v | grep '^AUGI_' || true); do ENV_PREFIX+=" $v=$(printf %q "${!v}")"; done
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SESSION="${AUGI_TMUX_SESSION:-augi-crew}"
WHO="${1:?Usage: restart-worker.sh <role-or-username>}"
NAME="$(node "$ROOT/scripts/crew-field.mjs" "$WHO" username)" || { echo "unknown worker: $WHO" >&2; exit 2; }

# Every MCP server controlling this character, attached or orphaned. The
# pane is the one whose Codex (the pane's own process) is a server's parent;
# Codex renames pane titles, so titles cannot be used.
PANE=""
PIDS=()
for pid in $(pgrep -f "$ROOT/runtime/mcp/server.js" || true); do
  ps eww -p "$pid" | tr ' ' '\n' | grep -qx "MC_USERNAME=$NAME" || continue
  PIDS+=("$pid")
  parent="$(ps -o ppid= -p "$pid" | tr -d ' ')"
  [[ -z "$PANE" ]] && PANE="$(tmux list-panes -t "$SESSION" -F '#{pane_id} #{pane_pid}' | awk -v p="$parent" '$2 == p { print $1; exit }')"
done
for pid in ${PIDS[@]+"${PIDS[@]}"}; do
  echo "stopping MCP server $pid for $NAME"
  kill "$pid" 2>/dev/null || true
done

if [[ -n "$PANE" ]]; then
  tmux respawn-pane -k -t "$PANE" -c "$ROOT" "$ENV_PREFIX ./agents/crew/start-worker.sh $WHO"
else
  tmux split-window -t "$SESSION" -c "$ROOT" "$ENV_PREFIX ./agents/crew/start-worker.sh $WHO"
  tmux select-layout -t "$SESSION" tiled
fi
echo "restarted $NAME"
