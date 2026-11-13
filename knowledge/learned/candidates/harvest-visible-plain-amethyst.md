---
id: harvest-visible-plain-amethyst
title: Harvest visible plain amethyst
description: Harvest reachable visible plain amethyst in a natural geode while preserving budding amethyst and blocks below feet. Returns mined count; drops require separate collection.
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.harvestVisiblePlainAmethyst({ maxBlocks = 64 })"
status: candidate
source:
  origin: learned
  created: 2026-10-25T22:33:32.731Z
  updated: 2026-10-25T22:33:32.731Z
version: 1
evidence: []
stats:
  successes: 0
  failures: 0
failure_modes:
  - May leave drops on lower floor; mined is not inventory count.
  - Requires confirmed natural geode and permission to mine, never an existing building.
  - Stops when visible targets cannot be reached or stone picks run out.
tags:
  - gatherer
---

Harvest reachable visible plain amethyst in a natural geode while preserving budding amethyst and blocks below feet. Returns mined count; drops require separate collection.

Args: `{ maxBlocks = 64 }`

## Code

```js
let mined=0;for(let round=0;round<(args.maxBlocks??64);round++){signal.check();const p=bot.entity.position;const pick=bot.inventory.items().filter(i=>i.name==='stone_pickaxe').sort((a,b)=>(a.durabilityUsed||0)-(b.durabilityUsed||0))[0];if(!pick)break;await bot.equip(pick,'hand');const candidates=bot.findBlocks({matching:b=>b.name==='amethyst_block',maxDistance:6,count:128}).map(v=>bot.blockAt(v)).filter(b=>b&&b.position.y>=Math.floor(p.y)&&bot.canSeeBlock(b));candidates.sort((a,b)=>a.position.distanceTo(p)-b.position.distanceTo(p));const close=candidates.find(b=>b.position.distanceTo(p.offset(0,1,0))<4.5&&bot.canDigBlock(b));if(close){await bot.dig(close);mined++;continue;}if(!candidates.length)break;const b=candidates[0];const r=await lib.navigate_to({x:b.position.x,y:b.position.y,z:b.position.z,range:3,walkOnly:true});if(!r.ok)break;}return {mined,amethyst:bot.inventory.items().filter(i=>i.name==='amethyst_block').reduce((n,i)=>n+i.count,0),position:bot.entity.position};
```
