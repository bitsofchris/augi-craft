#!/usr/bin/env node
// Publish check: nothing personal may enter this repository.
//
//   npm run check:publish            every tracked file
//   node scripts/check-publish.mjs --staged   files staged for commit (pre-commit hook)
//
// Fails on:
//   - paths that belong to an instance (episodes, worlds, a crew.json, voice
//     recordings, replay files, server folders, .env)
//   - home-directory paths (/Users/<x>, /home/<x>, C:\Users\<x>)
//   - secret-looking strings (API keys, tokens, private keys)
//   - world coordinates in docs, role files, templates and the starter pack
//     (the same scan kb_promote uses; tests and code are exempt)
//   - people's names from the instance's crew.json, when $AUGI_HOME has one
//     (the private instance knows the names; the public repo never holds them).
//     A name also matches without its trailing digits.
// See docs/PUBLISHING.md.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { homePaths, loadCrew, privateNames } from '../runtime/home.js'
import { nameForms, privateFacts } from '../runtime/memory/store.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const staged = process.argv.includes('--staged')

const FORBIDDEN_PATHS = [
  [/^knowledge\/episodes\//, 'episodes are instance memory'],
  [/^knowledge\/worlds?\//, 'world state is instance-specific'],
  [/^knowledge\/learned\/(evidence|deprecated)\//, 'the starter pack is validated/ and candidates/ only'],
  [/(^|\/)crew\.json$/, 'a real crew file names people; ship crew.example.json'],
  [/^knowledge\/core\/MAP\.md$/, 'MAP.md is generated per instance', text => /BEGIN GENERATED[^\n]*\n(?!<!-- END)/.test(text)],
  [/^(?!templates\/)(.*\/)?augi\.config\.json$/, 'instance config; ship templates/home/augi.config.json'],
  [/^(local-server|local-voice|server|voice|recordings|instance)\//, 'instance folders'],
  [/\.(wav|mcpr|jsonl|pem|p12|key)$/, 'recordings, replays, logs and keys'],
  [/(^|\/)\.env(\..*)?$/, 'environment files'],
  [/^\.codex\//, 'a personal Codex config'],
  [/^docs\/film\//, 'shot logs hold players\' chat']
]

const CONTENT_PATTERNS = [
  [/\/Users\/[A-Za-z0-9._-]+\//, 'a macOS home path'],
  [/\/home\/[A-Za-z0-9._-]+\//, 'a Linux home path'],
  [/[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/, 'a Windows home path'],
  [/sk-(ant-)?[A-Za-z0-9_-]{20,}/, 'an API key'],
  [/AKIA[0-9A-Z]{16}/, 'an AWS key'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'a GitHub token'],
  [/xox[abp]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key']
]

const files = execFileSync('git', staged
  ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
  : ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)

const names = privateNames(loadCrew(homePaths().crewFile)).filter(n => !/^player\d*$/i.test(n))
// Prose and shipped knowledge must hold in any world; fixtures and code may use numbers freely.
// (The Voyager seeds are third-party code, imported unchanged.)
const NO_COORDINATES = /^(docs|agents|templates|\.claude|knowledge(?!\/seeds\/voyager-imported))\/|^[^/]+\.md$/
const problems = []

for (const file of files) {
  let text = null
  try { text = fs.readFileSync(path.join(root, file), 'utf8') } catch {}
  for (const [re, why, unless] of FORBIDDEN_PATHS) if (re.test(file) && (!unless || unless(text ?? ''))) problems.push(`${file}: ${why}`)
  if (text === null || file === 'package-lock.json' || /\.(png|jpg|jpeg|gif|mp4|zip)$/i.test(file)) continue
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const [re, why] of CONTENT_PATTERNS) if (re.test(line)) problems.push(`${file}:${i + 1}: ${why}: ${line.trim().slice(0, 100)}`)
    if (NO_COORDINATES.test(file)) for (const f of privateFacts(line)) if (f.what.startsWith('world coordinates')) problems.push(`${file}:${i + 1}: ${f.what}`)
    const lower = line.toLowerCase()
    for (const n of names) if (nameForms(n).some(form => lower.includes(form))) problems.push(`${file}:${i + 1}: names a person from your crew.json (${n})`)
  })
}

if (problems.length) {
  console.error(`check:publish found ${problems.length} problem(s) in ${staged ? 'staged files' : 'tracked files'}:\n`)
  for (const p of problems) console.error('  ' + p)
  console.error('\nMove instance data to $AUGI_HOME (docs/INSTANCE.md) or make the text general.')
  process.exit(1)
}
console.log(`check:publish: ${files.length} ${staged ? 'staged' : 'tracked'} files clean${names.length ? ` (also checked ${names.length} private name(s) from your crew.json)` : ''}`)
