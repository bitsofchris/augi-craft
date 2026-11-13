#!/bin/bash
# Make a fresh, empty instance for the fresh-agent experiment
# (docs/FRESH_AGENT.md): its own git repo with auto-commits, a config with no
# seed packs and no lib game actions, a live TIMELINE.md, and an MCP config
# for one bot. The directory is an AUGI_HOME; open its knowledge/ folder as an
# Obsidian vault to watch it fill up.
#
# Usage: scripts/fresh-kb.sh <new-dir> [bot-username]   (default AgentMiner)
set -euo pipefail

if [ $# -lt 1 ]; then echo "usage: $0 <new-dir> [bot-username]" >&2; exit 2; fi
repo="$(cd "$(dirname "$0")/.." && pwd)"
dir="$1"
user="${2:-AgentMiner}"
if [ -e "$dir" ]; then echo "$dir already exists; pick a new directory" >&2; exit 1; fi
mkdir -p "$dir"
dir="$(cd "$dir" && pwd)"

kb="$dir/knowledge"
mkdir -p "$kb"/core "$kb"/episodes "$kb"/worlds "$kb"/learned/{candidates,validated,deprecated,evidence} "$dir"/.claude/commands
cp "$repo/templates/fresh-kb/core/AGENTS.md" "$kb/core/AGENTS.md"
cp "$repo/.claude/commands/play.md" "$dir/.claude/commands/play.md"
touch "$kb"/episodes/.gitkeep "$kb"/learned/{candidates,validated,deprecated,evidence}/.gitkeep
# A fresh agent starts with nothing learned: mark the starter pack as handled so it is not copied in.
printf '{ "installed": null, "copied": [], "note": "fresh instance: no starter pack" }\n' > "$kb/learned/.starter-pack.json"

cat > "$dir/augi.config.json" <<EOF
{
  "name": "fresh",
  "packs": [],
  "includeLearned": true,
  "lib": [],
  "timeline": true,
  "autoCommit": true
}
EOF

cat > "$kb/TIMELINE.md" <<EOF
# Timeline

What the agent learned, newest last.
EOF

cat > "$dir/mcp.json" <<EOF
{
  "mcpServers": {
    "augi-craft": {
      "command": "node",
      "args": ["$repo/runtime/mcp/server.js"],
      "env": {
        "MC_HOST": "127.0.0.1",
        "MC_PORT": "25565",
        "MC_USERNAME": "$user",
        "MC_AUTH": "offline",
        "MC_VERSION": "26.3",
        "AUGI_HOME": "$dir"
      }
    }
  }
}
EOF

cat > "$dir/CLAUDE.md" <<EOF
# $user

You are $user, a Minecraft agent with no skills yet. Use only the augi-craft
MCP tools. Start every session with kb_map and follow core/AGENTS.md exactly.
EOF

printf '.obsidian/\nknowledge/.augi-write.lock\nknowledge/shlock*\nrecordings/\n' > "$dir/.gitignore"

(cd "$repo" && AUGI_HOME="$dir" node --input-type=module -e '
  const { KnowledgeStore, loadConfig } = await import("./runtime/memory/store.js")
  const { homePaths } = await import("./runtime/home.js")
  const p = homePaths()
  new KnowledgeStore(p.knowledgeDir, loadConfig(p.configFile), { appRoot: p.appKnowledgeDir }).rebuildMap()
')

git -C "$dir" init -q
# A machine with no Git identity (CI, a fresh install) gets a local one.
git -C "$dir" config user.name >/dev/null 2>&1 || git -C "$dir" config user.name augi-craft
git -C "$dir" config user.email >/dev/null 2>&1 || git -C "$dir" config user.email augi-craft@localhost
git -C "$dir" add --all .
git -C "$dir" commit -q -m "fresh knowledge base for $user"

cat <<EOF
Fresh knowledge base for $user at $dir

Next:
  1. Whitelist $user on the new world.
  2. Open $dir/knowledge as an Obsidian vault and pin TIMELINE.md.
  3. Start the agent from that directory, with only its augi-craft tools
     (no built-in tools, no prompts; the prompt goes first because the
     flags after it take several values):
       cd "$dir" && claude "/play get me a diamond" --tools "" --allowedTools "mcp__augi-craft" --strict-mcp-config --mcp-config mcp.json
EOF
