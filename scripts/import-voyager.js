#!/usr/bin/env node
// Import a Voyager skill library (skill/skills.json) as an *unverified*,
// reference seed pack. The code uses Voyager primitives, so agents adapt it to lib.
//
// Usage: node scripts/import-voyager.js <path/to/Voyager/skill_library/trial1> [--out knowledge/seeds/voyager-imported] [--trial trial1]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify, slugify } from '../runtime/memory/frontmatter.js'

export const VOYAGER_PRIMITIVES = ['mineBlock', 'craftItem', 'smeltItem', 'placeItem', 'killMob', 'exploreUntil', 'getItemFromChest', 'depositItemIntoChest', 'checkItemInsideChest', 'useChest', 'shoot']

// Rough mapping from Voyager control primitives to Augi lib actions.
const PRIMITIVE_TO_TOOL = {
  mineBlock: 'gather_blocks', craftItem: 'craft_item', smeltItem: 'smelt_item', placeItem: 'place_block',
  exploreUntil: 'navigate_to', getItemFromChest: 'withdraw_items', depositItemIntoChest: 'deposit_items',
  checkItemInsideChest: 'withdraw_items', useChest: 'deposit_items'
}

export function kebab (name) {
  return slugify(name.replace(/([a-z0-9])([A-Z])/g, '$1-$2'))
}

/** Extract the natural-language summary from Voyager's generated description. */
export function cleanDescription (desc) {
  const m = desc.match(/\/\/\s*([\s\S]*?)\n\s*\}/)
  return (m ? m[1] : desc).replace(/\s*\/\/\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

export function convertSkill (name, entry, { trial = 'trial1', allNames = [] } = {}) {
  const code = entry.code ?? ''
  const primitives = VOYAGER_PRIMITIVES.filter(p => new RegExp(`\\b${p}\\(`).test(code))
  const skills = allNames.filter(n => n !== name && new RegExp(`\\b${n}\\(`).test(code)).map(kebab)
  const description = cleanDescription(entry.description ?? name)
  const data = {
    id: `voyager-${kebab(name)}`,
    title: name,
    description,
    kind: 'code-reference',
    level: 2,
    when: [description.split('.')[0]],
    prerequisites: [],
    depends_on: {
      tools: [...new Set(primitives.map(p => PRIMITIVE_TO_TOOL[p]).filter(Boolean))],
      skills: skills.map(s => `voyager-${s}`)
    },
    implementation: 'reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions',
    status: 'unverified',
    source: {
      origin: 'imported:voyager',
      repo: 'https://github.com/MineDojo/Voyager',
      path: `skill_library/${trial}/skill/code/${name}.js`,
      license: 'MIT (c) 2023 MineDojo Team',
      version: 1
    },
    version: 1,
    voyager_primitives: primitives,
    evidence: [],
    failure_modes: ['Written for Voyager\'s Minecraft 1.19 runtime and helper globals; untested on this server.'],
    tags: ['voyager', ...primitives.map(p => p.toLowerCase())]
  }
  const body = `## Summary\n\n${description}\n\n## How to use in Augi\n\nThe code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (${data.depends_on.tools.join(', ') || 'see code'}), test it, and save it with save_helper.\n\n## Reference code (Voyager, MIT)\n\n\`\`\`javascript\n${code.trim()}\n\`\`\`\n`
  return { id: data.id, text: stringify(data, body) }
}

export function importLibrary (libDir, outDir, { trial = path.basename(libDir) } = {}) {
  const skills = JSON.parse(fs.readFileSync(path.join(libDir, 'skill', 'skills.json'), 'utf8'))
  const names = Object.keys(skills)
  fs.mkdirSync(outDir, { recursive: true })
  for (const name of names) {
    const { id, text } = convertSkill(name, skills[name], { trial, allNames: names })
    fs.writeFileSync(path.join(outDir, `${id}.md`), text)
  }
  return names.length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const lib = args.find(a => !a.startsWith('--'))
  if (!lib) {
    console.error('Usage: node scripts/import-voyager.js <Voyager/skill_library/trialN> [--out dir]')
    process.exit(1)
  }
  const outIdx = args.indexOf('--out')
  const out = outIdx >= 0 ? args[outIdx + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'knowledge', 'seeds', 'voyager-imported')
  const n = importLibrary(path.resolve(lib), path.resolve(out))
  console.log(`Imported ${n} Voyager skills into ${out} (status: unverified, reference-only)`)
}
