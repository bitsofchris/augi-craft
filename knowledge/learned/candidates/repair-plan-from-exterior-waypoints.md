---
id: repair-plan-from-exterior-waypoints
title: Repair plan from exterior waypoints
description: Repair exact authorized block plan from explicit exterior standing waypoints, clearing snow and verifying each exact material.
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.repairPlanFromExteriorWaypoints({plan:[{x,y,z,block,stand:{x,y,z}}]})"
status: candidate
source:
  origin: learned
  created: 2026-11-12T23:33:24.898Z
  updated: 2026-11-12T23:33:24.898Z
version: 1
evidence:
  - episode: 2026-11-12-23-33-12
    outcome: success
    note: created from episode
    date: 2026-11-12T23:33:24.899Z
stats:
  successes: 1
  failures: 0
failure_modes:
  - Standing inside a target cell prevents placement.
  - Caller must supply reachable exterior waypoints and materials.
tags:
  - agent
  - builder
  - shared
---

Repair exact authorized block plan from explicit exterior standing waypoints, clearing snow and verifying each exact material.

Args: `{plan:[{x,y,z,block,stand:{x,y,z}}]}`

## Code

```js
const errors=[];for(const p of args.plan){signal.check();const v=new Vec3(p.x,p.y,p.z);if(bot.blockAt(v)?.name===p.block)continue;const go=await lib.navigate_to({...p.stand,range:0,walkOnly:true});if(!go.ok){errors.push(go.summary);continue;}const b=bot.blockAt(v);if(b?.name==='snow')await bot.dig(b);else if(b?.boundingBox==='block'){errors.push('Occupied '+p.x+','+p.y+','+p.z);continue;}const r=await lib.place_block({item:p.block,x:p.x,y:p.y,z:p.z});if(!r.ok)errors.push(r.summary);}const missing=args.plan.filter(p=>bot.blockAt(new Vec3(p.x,p.y,p.z))?.name!==p.block);return {total:args.plan.length,verified:args.plan.length-missing.length,missingCount:missing.length,missing,errors};
```
