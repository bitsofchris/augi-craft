// Short synchronous transactions shared by all bot processes on this machine.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const held = new Set()
const sleeper = new Int32Array(new SharedArrayBuffer(4))
export function withKnowledgeLock (root, fn, timeoutMs = 15_000) {
  const dir = fs.realpathSync(root)
  if (held.has(dir)) return fn()
  const file = path.join(dir, '.augi-write.lock')
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let acquired = false
    if (process.platform === 'darwin') {
      // shlock atomically links a PID lock and recovers locks of dead processes.
      const result = spawnSync('/usr/bin/shlock', ['-p', String(process.pid), '-f', file])
      if (result.error) throw result.error
      acquired = result.status === 0
    } else {
      try { fs.writeFileSync(file, String(process.pid), { flag: 'wx' }); acquired = true } catch (e) {
        if (e.code !== 'EEXIST') throw e
      }
    }
    if (acquired) break
    if (Date.now() >= deadline) throw new Error(`Knowledge base busy: ${file}. Retry; never delete a live process's lock.`)
    Atomics.wait(sleeper, 0, 0, 25)
  }
  held.add(dir)
  try { return fn() } finally { held.delete(dir); fs.unlinkSync(file) }
}

export function lockMethods (instance, root, methods) {
  fs.mkdirSync(root, { recursive: true })
  for (const name of methods) {
    const original = instance[name].bind(instance)
    instance[name] = (...args) => withKnowledgeLock(root, () => original(...args))
  }
}

export function atomicWrite (file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`
  try { fs.writeFileSync(temp, text); fs.renameSync(temp, file) } finally {
    try { fs.unlinkSync(temp) } catch (e) { if (e.code !== 'ENOENT') throw e }
  }
}
