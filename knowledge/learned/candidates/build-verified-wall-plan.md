---
id: build-verified-wall-plan
title: Build verified wall plan
description: Place an authorized mixed-stone wall plan from explicit safe standing waypoints, bottom layers first; verify block names after placement and report missing blocks. Does not gather or remove existing solid blocks.
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.buildVerifiedWallPlan({plan:[{x,y,z,stand:{x,y,z}}]})"
status: candidate
source:
  origin: learned
  created: 2026-10-20T22:07:30.556Z
  updated: 2026-10-20T22:07:30.556Z
version: 1
evidence:
  - episode: 2026-10-20-22-07-21
    outcome: success
    note: created from episode
    date: 2026-10-20T22:07:30.557Z
  - episode: 2026-10-20-22-28-35
    outcome: success
    note: job36 verified25/25 wall repair positions after reaching ground.
    date: 2026-10-20T22:28:35.757Z
stats:
  successes: 2
  failures: 0
failure_modes:
  - Missing inventory or unreachable standing waypoint leaves missing blocks for rerun.
tags:
  - agent
  - builder
  - shared
---

Place an authorized mixed-stone wall plan from explicit safe standing waypoints, bottom layers first; verify block names after placement and report missing blocks. Does not gather or remove existing solid blocks.

Args: `{plan:[{x,y,z,stand:{x,y,z}}]}`

## Code

```js
const names=['cobblestone','cobbled_deepslate','diorite','granite','andesite','calcite','smooth_basalt','amethyst_block'];
const plan=args.plan.map(p=>({...p}));
const faces=[[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0]];
const placed=[];let pending=plan;const failures=[];
for(let pass=0;pass<3&&pending.length;pass++){const next=[];for(const p of pending){signal.check();const v=new Vec3(p.x,p.y,p.z);const b=bot.blockAt(v);if(b?.boundingBox==='block'){placed.push(p);continue;}
const stand=p.stand; if(!stand)throw new Error('Each plan entry needs a safe stand waypoint');
if(bot.entity.position.distanceTo(v.offset(.5,.5,.5))>4.3){const go=await lib.navigate_to({...stand,range:1,walkOnly:true});if(!go.ok){log('approach '+go.summary);next.push(p);continue;}}
const item=names.map(n=>bot.inventory.items().find(i=>i.name===n)).find(Boolean);if(!item){next.push(p);continue;}p.block=item.name;
let ok=false;for(const [dx,dy,dz]of faces){const ref=bot.blockAt(v.offset(dx,dy,dz));if(ref?.boundingBox!=='block')continue;try{await bot.equip(item,'hand');await bot.placeBlock(ref,new Vec3(-dx,-dy,-dz));await sleep(100);if(bot.blockAt(v)?.name===p.block){ok=true;break;}}catch(e){failures.push(String(e.message));}}
if(ok)placed.push(p);else next.push(p);if(placed.length%15===0)log('verified '+placed.length+'/'+plan.length);}
pending=next;log('pass '+pass+': '+(plan.length-pending.length)+'/'+plan.length);}
const missing=plan.filter(p=>!names.includes(bot.blockAt(new Vec3(p.x,p.y,p.z))?.name));return {total:plan.length,verified:plan.length-missing.length,missing,errors:failures.slice(-5),position:bot.entity.position};
```

## Notes

Derived from 145/145 verified five-high south/east walls beside a base. Supply authorized inventory first; plan must be bottom-up, loaded and reachable. Existing solid blocks are preserved; final check counts approved stone materials only.
