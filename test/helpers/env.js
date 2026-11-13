// Loaded by `npm test` (node --test --import): tests run against an empty,
// throw-away instance so a developer's own $AUGI_HOME never leaks in.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.AUGI_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-home-'))
delete process.env.AUGI_KNOWLEDGE_DIR
delete process.env.AUGI_CONFIG
delete process.env.AUGI_CREW_FILE
delete process.env.AUGI_WORLD
delete process.env.AUGI_RECORD
delete process.env.AUGI_RECORD_DIR
