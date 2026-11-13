import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { KnowledgeStore } from '../runtime/memory/store.js'
import { LocationStore } from '../runtime/tools/locations.js'
import { withKnowledgeLock } from '../runtime/memory/lock.js'

const storeURL = new URL('../runtime/memory/store.js', import.meta.url).href
const locationsURL = new URL('../runtime/tools/locations.js', import.meta.url).href
const lockURL = new URL('../runtime/memory/lock.js', import.meta.url).href
function child (code, dir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--input-type=module', '-e', code, dir], { stdio: ['ignore', 'ignore', 'pipe'] })
    let errors = ''; p.stderr.on('data', d => { errors += d })
    p.on('error', reject); p.on('exit', c => c === 0 ? resolve() : reject(new Error(errors || `exit ${c}`)))
  })
}
test('four processes retain every episode, evidence update and location', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-shared-'))
  try {
    const store = new KnowledgeStore(dir, { packs: [] })
    store.saveSkill({ id: 'delivery', title: 'Delivery', description: 'Return items', procedure: 'Use deposit_items.' })
    await Promise.all(Array.from({ length: 4 }, (_, worker) => child(`
      import { KnowledgeStore } from ${JSON.stringify(storeURL)};
      import { LocationStore } from ${JSON.stringify(locationsURL)};
      import path from 'node:path';
      const dir=process.argv[1]; const s=new KnowledgeStore(dir,{packs:[]});
      const l=new LocationStore(path.join(dir,'world','locations.json'));
      s.now=()=>new Date('2026-10-12T00:00:00Z');
      for(let i=0;i<6;i++) {
        const ep=s.writeEpisode({task:'same-task',outcome:'success'});
        s.recordOutcome('delivery',{episode:ep.id,outcome:'success'});
        l.save('worker-${worker}-'+i,{x:${worker},y:64,z:i});
        s.rebuildMap();
      }`, dir)))
    assert.equal(store.episodes({ limit: 100 }).length, 24)
    assert.equal(store.get('delivery').stats.successes, 24)
    assert.equal(new LocationStore(path.join(dir, 'world', 'locations.json')).list().length, 24)
    assert.match(fs.readFileSync(path.join(dir, 'core/MAP.md'), 'utf8'), /delivery/)
    assert.equal(fs.existsSync(path.join(dir, '.augi-write.lock')), false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('macOS recovers lock after writer exits without releasing it', { skip: process.platform !== 'darwin' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'augi-dead-lock-'))
  try {
    await child(`import {withKnowledgeLock} from ${JSON.stringify(lockURL)}; withKnowledgeLock(process.argv[1],()=>process.exit(0));`, dir)
    assert.equal(withKnowledgeLock(dir, () => 'recovered'), 'recovered')
    assert.equal(fs.existsSync(path.join(dir, '.augi-write.lock')), false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
