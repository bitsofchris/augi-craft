#!/usr/bin/env node
// Scripted end-to-end demonstration (no LLM): drives the same tools the MCP
// server exposes, in the order the agent is expected to discover.
//
//   observe -> find logs -> gather 4 logs -> planks + sticks -> crafting table
//   -> wooden pickaxe (+ axe if materials permit) -> verify inventory
//   -> write episode + reusable lesson -> rebuild MAP.md
//
// Usage: MC_HOST=127.0.0.1 MC_PORT=25565 node scripts/demo-starter-tools.js [--dry-run-kb]
import { createAugi } from '../runtime/mcp/augi.js'
import { augiOptions } from '../runtime/home.js'
import { inventoryCounts } from '../runtime/tools/result.js'

// Episodes and the lesson go to the instance (AUGI_HOME), like the MCP server's.
const augi = createAugi(augiOptions())
const actions = []
const observations = []

// Direct MCP tools run as-is; lib actions run as a one-line program.
async function step (name, args = {}) {
  const direct = augi.tool(name)
  let res
  if (direct) {
    res = await direct.run(args)
  } else {
    const env = await augi.tool('run_program').run({ code: `return await lib.${name}(args)`, args })
    const r = env.observations?.returned
    res = r ? { ...env, ok: r.ok, summary: r.summary, error: r.error, observations: r.observations } : env
  }
  const delta = Object.entries(res.changes?.inventory ?? {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')
  console.log(`${res.ok ? '✔' : '✘'} ${name} ${JSON.stringify(args)} -> ${res.summary}${delta ? `  [${delta}]` : ''}${res.ok ? '' : `  (${res.error?.category})`}`)
  actions.push(`${name} ${JSON.stringify(args)} -> ${res.ok ? 'ok' : res.error?.category}: ${res.summary}`)
  return res
}

function logSpecies (counts) {
  return Object.keys(counts).filter(n => n.endsWith('_log')).sort((a, b) => counts[b] - counts[a])[0]
}

async function main () {
  console.log('Retrieving skills before acting:')
  for (const r of (await augi.tool('kb_search').run({ query: 'gather wood logs starter tools pickaxe' })).results) {
    console.log(`  - ${r.id} (${r.status}): ${r.description}`)
  }

  const start = await step('observe')
  if (!start.ok) throw new Error('Cannot observe; is the server running? ' + start.summary)
  const before = start.observations.inventory

  // 2-3. Locate and collect logs.
  const need = Math.max(0, 4 - Object.entries(before).filter(([n]) => n.endsWith('_log')).reduce((s, [, c]) => s + c, 0))
  if (need > 0) {
    const found = await step('find_blocks', { block: 'log', maxDistance: 64 })
    if (!found.ok) throw new Error('No trees nearby; move the bot near trees and retry.')
    observations.push(`Nearest log: ${found.observations.blocks[0].name} at ${JSON.stringify(found.observations.blocks[0].position)} (${found.observations.blocks[0].distance} blocks)`)
    let gathered = await step('gather_blocks', { block: 'log', count: need })
    if (!gathered.ok && gathered.error.category === 'partial') gathered = await step('gather_blocks', { block: 'log', count: need - gathered.observations.collected })
  }

  // 4. Planks and sticks.
  const bot = await augi.session.getBot()
  const species = logSpecies(inventoryCounts(bot))
  if (!species) throw new Error('No logs collected')
  const planks = species.replace(/_log$/, '_planks')
  const logs = inventoryCounts(bot)[species]
  await step('craft_item', { item: planks, count: Math.min(logs, 4) * 4 })
  await step('craft_item', { item: 'stick', count: 4 })

  // 5. Starter tools (crafting table first if none nearby).
  const obs = await step('observe')
  if (!obs.observations.notable.crafting_table && !inventoryCounts(bot).crafting_table) await step('craft_item', { item: 'crafting_table' })
  const pick = await step('craft_item', { item: 'wooden_pickaxe' })
  const counts = inventoryCounts(bot)
  if ((counts[planks] ?? 0) >= 3 && (counts.stick ?? 0) >= 2) await step('craft_item', { item: 'wooden_axe' })
  const table = (await step('find_blocks', { block: 'crafting_table', maxDistance: 16, count: 1 }))
  if (table.ok) await step('save_location', { name: 'crafting_table', note: 'placed during starter-tools demo' })

  // 6. Verify against actual inventory.
  const after = inventoryCounts(bot)
  const delta = Object.fromEntries(Object.keys({ ...before, ...after }).map(k => [k, (after[k] ?? 0) - (before[k] ?? 0)]).filter(([, v]) => v !== 0))
  const success = (after.wooden_pickaxe ?? 0) > (before.wooden_pickaxe ?? 0)
  const verification = `wooden_pickaxe ${before.wooden_pickaxe ?? 0} -> ${after.wooden_pickaxe ?? 0}; wooden_axe ${before.wooden_axe ?? 0} -> ${after.wooden_axe ?? 0}`
  console.log(`\nVerification: ${success ? 'PASS' : 'FAIL'} (${verification})`)

  // 7. Episode + reusable lesson.
  const ep = await augi.tool('kb_write_episode').run({
    task: 'Starter tools from nothing (scripted demo)',
    outcome: success ? 'success' : (pick.ok ? 'partial' : 'failure'),
    summary: 'Scripted run of the first end-to-end demonstration.',
    actions,
    observations,
    lessons: [`4 ${species} -> 16 ${planks} covers a crafting table, 4 sticks, a wooden pickaxe and a wooden axe with 4 planks spare.`],
    skills_used: ['gather-wood', 'craft-planks-and-sticks', 'build-crafting-station', 'acquire-starter-tools'],
    tools_used: [...new Set(actions.map(a => a.split(' ')[0]))],
    inventory_delta: delta,
    verification
  })
  console.log(`Episode: ${ep.path}`)
  for (const id of ['gather-wood', 'acquire-starter-tools']) {
    await augi.tool('kb_record_outcome').run({ id, episode: ep.id, outcome: success ? 'success' : 'failure' })
  }
  if (success) {
    const lesson = await augi.tool('kb_save_skill').run({
      id: 'four-log-starter-kit',
      title: 'Four-log starter kit',
      description: 'Plank budget: four logs provide enough for a crafting table, sticks, a wooden pickaxe and a wooden axe',
      kind: 'lesson',
      when: ['fresh world, empty inventory', 'planning how many logs to gather before crafting tools'],
      prerequisites: ['trees nearby'],
      depends_on: { skills: ['gather-wood', 'acquire-starter-tools'], tools: ['gather_blocks', 'craft_item'] },
      procedure: '1. gather_blocks {block: "log", count: 4}\n2. craft_item <species>_planks x16, then stick x4\n3. craft_item crafting_table (if none nearby), wooden_pickaxe, wooden_axe\n4. Verify both tools appear in inventory; 4 planks remain.',
      failure_modes: ['Mixed log species give mixed planks; craft each species separately or gather one species.'],
      episode: ep.id,
      outcome: 'success'
    })
    console.log(`Lesson: ${lesson.saved ? lesson.path : lesson.reason}`)
  }
  await augi.tool('kb_rebuild_map').run({})
  console.log('\nNext: restart your CLI session and ask it to `kb_search` for "starter kit" — see docs/SMOKE_TEST.md step 8.')
}

main()
  .catch(err => { console.error('Demo failed:', err.message); process.exitCode = 1 })
  .finally(() => { augi.session.bot?.quit?.(); setTimeout(() => process.exit(), 500) })
