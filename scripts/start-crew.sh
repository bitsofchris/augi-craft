#!/bin/bash
# Start a crew of workers, one tmux pane each (macOS/Linux; needs tmux and
# Codex CLI). Roles come from the instance's crew.json.
#
#   scripts/start-crew.sh                       gatherer hunter builder guard
#   scripts/start-crew.sh guard diamond agent1  any roles or usernames from crew.json
#
# AUGI_TMUX_SESSION names the session (default augi-crew). AUGI_* settings
# (AUGI_HOME, AUGI_WORLD, AUGI_RECORD) pass through to every worker.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMUX="$(command -v tmux || true)"
[[ -n "$TMUX" ]] || { echo "tmux is required (brew install tmux / apt install tmux)" >&2; exit 2; }
SESSION="${AUGI_TMUX_SESSION:-augi-crew}"
ROLES=("$@"); [[ ${#ROLES[@]} -gt 0 ]] || ROLES=(gatherer hunter builder guard)
field() { node "$ROOT/scripts/crew-field.mjs" "$@"; }
# tmux panes get the tmux server's environment, not this shell's: pass the
# AUGI_* settings through explicitly.
ENV_PREFIX="env"
for v in $(compgen -v | grep '^AUGI_' || true); do ENV_PREFIX+=" $v=$(printf %q "${!v}")"; done
if "$TMUX" has-session -t "$SESSION" 2>/dev/null; then
 echo "Crew already running. Attach: tmux attach -t $SESSION"
 exit 0
fi
"$TMUX" new-session -d -s "$SESSION" -n workers -x 220 -y 70 -c "$ROOT"
for ((i = 1; i < ${#ROLES[@]}; i++)); do "$TMUX" split-window -t "$SESSION:workers" -c "$ROOT"; "$TMUX" select-layout -t "$SESSION:workers" tiled >/dev/null; done
"$TMUX" set-option -t "$SESSION" mouse on
"$TMUX" set-option -t "$SESSION" pane-border-status top
"$TMUX" set-option -t "$SESSION" pane-border-format ' #[bold,fg=colour81]#{@worker} #[default]'
"$TMUX" set-option -t "$SESSION" allow-rename off
"$TMUX" set-option -t "$SESSION" remain-on-exit on
"$TMUX" set-option -t "$SESSION" status-right 'Crew | click pane | Ctrl-b z: zoom | Ctrl-b d: detach'
INDEX=0
for ROLE in "${ROLES[@]}"; do
 NAME="$(field "$ROLE" username)" || { echo "no worker or role '$ROLE' in $(field file)" >&2; exit 2; }
 TITLE="$NAME | $(field "$ROLE" role | tr '[:lower:]' '[:upper:]')"
 "$TMUX" select-pane -t "$SESSION:workers.$INDEX" -T "$TITLE"
 "$TMUX" set-option -p -t "$SESSION:workers.$INDEX" @worker "$TITLE"
 "$TMUX" send-keys -t "$SESSION:workers.$INDEX" "$ENV_PREFIX ./agents/crew/start-worker.sh $ROLE" Enter
 INDEX=$((INDEX + 1))
done
"$TMUX" select-pane -t "$SESSION:workers.0"
echo "Attach: tmux attach -t $SESSION"
