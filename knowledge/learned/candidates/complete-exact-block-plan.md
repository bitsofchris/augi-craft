---
id: complete-exact-block-plan
title: Complete exact block plan
description: Complete and verify supplied nearby block coordinates, preserving other solid blocks and refreshing held equipment on retries.
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.completeExactBlockPlan({plan:[{x,y,z,block}],passes=3})"
status: candidate
source:
  origin: learned
  created: 2026-11-12T23:30:34.953Z
  updated: 2026-11-12T23:30:34.953Z
version: 1
evidence:
  - episode: 2026-11-12-23-30-24
    outcome: success
    note: created from episode
    date: 2026-11-12T23:30:34.954Z
  - episode: 2026-11-12-23-31-36
    outcome: success
    note: 18/18 dragon sculpture coordinates verified after held-item synchronization retries.
    date: 2026-11-12T23:31:42.902Z
stats:
  successes: 2
  failures: 0
failure_modes:
  - Caller must provide safe approach and supplies; floor placements under the bot require moving aside first.
tags:
  - agent
  - builder
  - shared
---

Complete and verify supplied nearby block coordinates, preserving other solid blocks and refreshing held equipment on retries.

Args: `{plan:[{x,y,z,block}],passes=3}`

## Code

```js
const plan=args.plan;const failures=[];for(let pass=0;pass<(args.passes??3);pass++){for(const p of plan){signal.check();const b=bot.blockAt(new Vec3(p.x,p.y,p.z));if(b?.name===p.block)continue;if(b?.boundingBox==='block'){failures.push({p,error:'occupied'});continue;}await bot.unequip('hand');const r=await lib.place_block({item:p.block,x:p.x,y:p.y,z:p.z});if(!r.ok)failures.push({p,error:r.summary});}if(plan.every(p=>bot.blockAt(new Vec3(p.x,p.y,p.z))?.name===p.block))break;}const missing=plan.filter(p=>bot.blockAt(new Vec3(p.x,p.y,p.z))?.name!==p.block);return {total:plan.length,verified:plan.length-missing.length,missing,failures:failures.slice(-10)};
```
