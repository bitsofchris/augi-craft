#!/bin/bash
# Start one crew worker: a Codex CLI session driving one Minecraft character
# through its own augi-craft MCP server. The crew comes from the instance's
# crew.json ($AUGI_HOME/crew.json, else agents/crew/crew.example.json).
#
#   agents/crew/start-worker.sh <role-or-username> [resume-session prompt-file | --job prompt-file]
#
# Settings: AUGI_HOME (instance), CODEX_BIN (default: codex on PATH, else the
# ChatGPT app's bundled Codex on macOS), AUGI_CODEX_COMPACT_TOKENS,
# AUGI_WORLD, AUGI_RECORD. Extra Codex flags, one per line, may be put in
# $AUGI_HOME/codex.extra (for example -c lines that turn off other MCP servers).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
field() { node "$ROOT/scripts/crew-field.mjs" "$@"; }
WHO="${1:-}"
if [[ -z "$WHO" ]]; then
 echo "Usage: start-worker.sh <role-or-username> [resume-session prompt-file | --job prompt-file]" >&2
 echo "Workers in $(field file):" >&2; field workers >&2; exit 2
fi
NAME="$(field "$WHO" username)" || { echo "no worker or role '$WHO' in $(field file)" >&2; exit 2; }
ROLE="$(field "$WHO" role)"
PLAYER="$(field "$WHO" player 2>/dev/null || true)"
ROLE_FILE="$(field "$WHO" instructions 2>/dev/null || echo "$ROLE.md")"
HOME_DIR="$(field home)"
MODEL="$(field model 2>/dev/null || echo gpt-6.1-sol)"
EFFORT="$(field reasoningEffort 2>/dev/null || echo low)"
MC_HOST="$(field connection host 2>/dev/null || echo 127.0.0.1)"
MC_PORT="$(field connection port 2>/dev/null || echo 25565)"
MC_AUTH="$(field connection auth 2>/dev/null || echo offline)"
MC_VERSION="$(field connection version 2>/dev/null || echo 26.3)"
WORLD="${AUGI_WORLD:-$(field world 2>/dev/null || echo default)}"
# Guards stay with their player at night instead of digging in.
NIGHT_SHELTER=true
case "$ROLE" in guard|bodyguard) NIGHT_SHELTER=false ;; esac
CODEX_BIN="${CODEX_BIN:-$(command -v codex || echo /Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex)}"
NODE_BIN="$(command -v node)"
printf '\033]2;%s\007' "$NAME"
PLAYER_LINE=""
[[ -n "$PLAYER" ]] && PLAYER_LINE="Your player (the person your role serves) is $PLAYER."
PROMPT="You are $NAME, the $ROLE on this Minecraft server.
Read agents/crew/shared.md and agents/crew/$ROLE_FILE now. You control ONLY $NAME. $PLAYER_LINE
Your augi-craft MCP server is configured for your character and the shared knowledge base.
Startup: kb_map, observe (this connects), bot_status (verify the username is $NAME), list_helpers {role: \"$ROLE\"}.
If the username is not $NAME, stop and report; never control another worker.
Then say hello in game chat with your role, report your position here.
If your role file gives a standing job, start it now and never end your turn
while it is active (loop on wait_for_chat and job_status); otherwise listen
for orders with wait_for_chat (names: $NAME, $ROLE, everyone), calling it
again whenever you are idle. Play by writing programs with run_program.
Keep responses short and always identify yourself as $NAME.
Codex code mode hands a running cell back to you after about 30 s. When a cell
calls wait_for_chat (or a long foreground run_program), make its first line
// @exec: {\"yield_time_ms\": 250000}
so the cell returns once, when the call finishes, instead of you calling wait or sleep."
# Auto-approve this worker's own game and knowledge tools; the default Codex
# reviewer otherwise stalls a worker for minutes on every routine call.
APPROVE=()
for tool in observe say set_task mark_moment run_program job_status list_lib list_helpers save_helper stop_action bot_status read_chat wait_for_chat recall_location kb_map kb_search kb_get kb_save_skill kb_record_outcome kb_promote kb_deprecate kb_write_episode kb_recent_episodes kb_rebuild_map kb_commit; do
 APPROVE+=(-c "mcp_servers.augi-craft.tools.$tool.approval_mode=\"approve\"")
done
# Token budget: every model call re-reads the whole context, so compact it
# early; the bot's current order survives in set_task.
CODEX_EXTRA=(-c "model_auto_compact_token_limit=${AUGI_CODEX_COMPACT_TOKENS:-80000}")
if [[ -f "$HOME_DIR/codex.extra" ]]; then
 while IFS= read -r line; do [[ -n "$line" && "$line" != \#* ]] && CODEX_EXTRA+=("$line"); done < "$HOME_DIR/codex.extra"
fi
MODE=()
if [[ "${2:-}" == --job ]]; then
 PROMPT="$(cat "${3:?Pass a job prompt file}")"
elif [[ -n "${2:-}" ]]; then
 MODE=(resume "$2")
 PROMPT="$(cat "${3:?Pass a prompt file when resuming}")"
fi
exec "$CODEX_BIN" ${MODE[@]+"${MODE[@]}"} --no-daemon --no-alt-screen -C "$ROOT" -m "$MODEL" \
 -c "model_reasoning_effort=\"$EFFORT\"" \
 -c "mcp_servers.augi-craft.command=\"$NODE_BIN\"" \
 -c "mcp_servers.augi-craft.args=[\"$ROOT/runtime/mcp/server.js\"]" \
 -c 'mcp_servers.augi-craft.tool_timeout_sec=300' \
 "${APPROVE[@]}" \
 "${CODEX_EXTRA[@]}" \
 -c "mcp_servers.augi-craft.env={MC_HOST=\"$MC_HOST\",MC_PORT=\"$MC_PORT\",MC_USERNAME=\"$NAME\",MC_AUTH=\"$MC_AUTH\",MC_VERSION=\"$MC_VERSION\",AUGI_HOME=\"$HOME_DIR\",AUGI_NIGHT_SHELTER=\"$NIGHT_SHELTER\",AUGI_WORLD=\"$WORLD\",AUGI_RECORD=\"${AUGI_RECORD:-0}\"}" \
 "$PROMPT"
