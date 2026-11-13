---
id: compost-leaves-at-block
title: Compost carried leaves at a known composter
description: Processes carried leaf stacks, waits for level8, collects bone meal; checks composter each iteration.
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.compostLeavesAtBlock({x,y,z,maxIterations=180})"
status: candidate
source:
  origin: learned
  created: 2026-11-13T00:23:22.268Z
  updated: 2026-11-13T00:23:22.268Z
version: 1
evidence:
  - episode: 2026-11-13-00-23-09
    outcome: success
    note: created from episode
    date: 2026-11-13T00:23:22.270Z
stats:
  successes: 1
  failures: 0
failure_modes:
  - Missing composter
  - No carried leaves
tags:
  - shared
  - farming
---

Processes carried leaf stacks, waits for level8, collects bone meal; checks composter each iteration.

Args: `{x,y,z,maxIterations=180}`

## Code

```js
const {x,y,z,maxIterations=180}=args;const p=new Vec3(x,y,z);const r=await lib.navigate_to({x,y,z,walkOnly:true,range:2});if(!r.ok)return r;for(let k=0;k<maxIterations;k++){signal.check();const b=bot.blockAt(p);if(b?.name!=='composter')return {ok:false,reason:'missing composter'};const level=Number(b.getProperties().level);if(level>=7){await sleep(1500);await bot.unequip('hand');await bot.activateBlock(bot.blockAt(p));await lib.navigate_to({x,y,z,walkOnly:true,range:1});await sleep(500);continue;}const i=bot.inventory.items().find(i=>i.name.endsWith('_leaves'));if(!i)break;await bot.equip(i,'hand');await bot.activateBlock(b);await sleep(180);}return {ok:true,boneMeal:bot.inventory.items().filter(i=>i.name==='bone_meal').reduce((s,i)=>s+i.count,0)};
```
