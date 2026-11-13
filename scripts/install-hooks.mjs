#!/usr/bin/env node
// `npm prepare` hook: make Git run .githooks/pre-commit (the publish check)
// in this clone. Silent outside a Git checkout (npm pack, CI tarballs).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (!fs.existsSync(path.join(root, '.git'))) process.exit(0)
try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root, stdio: 'ignore' })
  fs.chmodSync(path.join(root, '.githooks', 'pre-commit'), 0o755)
} catch { /* no git on PATH: hooks stay off */ }
