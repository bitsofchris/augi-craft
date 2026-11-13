#!/usr/bin/env node
// Augi MCP server (stdio). Exposes trusted game tools plus knowledge-base tools
// to Claude Code, Codex CLI, or any MCP client.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createAugi } from './augi.js'
import { augiOptions, ensureHome, homePaths } from '../home.js'
import { formatResult } from './compact.js'

// stdout is the MCP channel: route stray logging to stderr.
console.log = (...args) => console.error(...args)

// Everything personal lives in the instance directory (AUGI_HOME); the
// protocol and seed skills are read from this repo when the instance has none.
const paths = ensureHome(homePaths())
const augi = createAugi(augiOptions(paths))

const server = new McpServer({ name: 'augi-craft', version: '0.1.0' })
for (const t of augi.tools) {
  server.registerTool(t.name, { description: t.description, inputSchema: t.input }, async (args) => {
    const result = await t.run(args ?? {})
    return {
      content: [{ type: 'text', text: formatResult(result) }],
      isError: result?.ok === false && result?.error?.category === 'invalid_argument'
    }
  })
}

// Finish an open replay file when the worker stops (Codex closes or kills us).
const finishReplay = () => { try { augi.session.bot?.augiRecorder?.close() } catch {} }
process.on('exit', finishReplay)
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => { finishReplay(); process.exit(0) })
process.stdin.on('end', () => { finishReplay(); process.exit(0) })

await server.connect(new StdioServerTransport())
console.error(`[augi-craft] MCP server ready (home: ${paths.home}, config: ${augi.store.config.name}, packs: ${augi.store.config.packs.join(', ')})`)
