import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

// npm 12 refuses git dependencies by default (EALLOWGIT). While the lock file
// has any, the project's .npmrc must allow them or `npm ci` fails for newcomers.
test('.npmrc allows git dependencies while the lock file has them', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
  const git = Object.entries(lock.packages).filter(([, p]) => /^git\+/.test(p.resolved ?? '')).map(([name]) => name)
  if (!git.length) return
  const npmrc = readFileSync(path.join(root, '.npmrc'), 'utf8')
  assert.match(npmrc, /^allow-git\s*=\s*all\s*$/m, `package-lock.json has git dependencies (${git.join(', ')}) but .npmrc does not set allow-git=all`)
})
