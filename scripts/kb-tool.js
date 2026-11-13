#!/usr/bin/env node
// Local access to the existing knowledge-only tools, with gameplay disabled.
import fs from 'node:fs'
import { createAugi } from '../runtime/mcp/augi.js'
import { augiOptions } from '../runtime/home.js'
import { z } from 'zod'

const allowed = new Set(['kb_map', 'kb_get', 'kb_search', 'kb_recent_episodes',
  'kb_write_episode', 'kb_save_skill', 'kb_record_outcome', 'kb_rebuild_map',
  'kb_promote', 'kb_deprecate'])
const [name, inputFile] = process.argv.slice(2)
if (!allowed.has(name)) {
  console.error('Usage: node scripts/kb-tool.js <knowledge-tool-name> [JSON-input-file]')
  process.exit(2)
}
const augi = createAugi({ ...augiOptions(),
  connect: async () => { throw new Error('Gameplay is disabled in the knowledge CLI') } })
const tool = augi.tool(name)
const input = z.object(tool.input).parse(inputFile ? JSON.parse(fs.readFileSync(inputFile, 'utf8')) : {})
const result = await tool.run(input)
console.log(JSON.stringify(result, null, 2))
if (result.ok === false) process.exitCode = 1
