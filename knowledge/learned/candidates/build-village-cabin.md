---
id: build-village-cabin
title: Build village cabin
description: "Build a 5x5 cobblestone foundation, spruce corner logs and walls, three glass windows, north door, pitched plank gable roof and torch. Needs 30 cobblestone, 12 logs, 75 planks, 3 glass, 1 door, 1 torch, pickaxe. Uses raw placement without automatic navigation and removes its interior scaffold. Candidate: assembled from verified first-cabin stages; inspect returned missing blocks."
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.buildVillageCabin({ x, z, y=63 })"
status: candidate
source:
  origin: learned
  created: 2026-10-20T22:29:15.616Z
  updated: 2026-10-20T22:29:15.616Z
version: 1
evidence:
  - episode: 2026-10-20-22-25-58
    outcome: success
    note: created from episode
    date: 2026-10-20T22:29:15.617Z
  - episode: 2026-10-20-22-37-03
    outcome: success
    note: Verified complete after death recovery and straight entrance waypoints; helper needs entrance recovery improvement.
    date: 2026-10-20T22:37:19.334Z
  - episode: 2026-10-20-22-41-03
    outcome: success
    note: Adapted program completed cabin with no missing planned blocks, north door and clear interior.
    date: 2026-10-20T22:41:03.712Z
stats:
  successes: 3
  failures: 0
failure_modes:
  - Natural terrain or player blocks occupying the plan stops construction
  - Axe/pickaxe and materials must be prepared first
  - No food gathering; carry food
tags:
  - agent
  - builder
  - shared
---

Build a 5x5 cobblestone foundation, spruce corner logs and walls, three glass windows, north door, pitched plank gable roof and torch. Needs 30 cobblestone, 12 logs, 75 planks, 3 glass, 1 door, 1 torch, pickaxe. Uses raw placement without automatic navigation and removes its interior scaffold. Candidate: assembled from verified first-cabin stages; inspect returned missing blocks.

Args: `{ x, z, y=63 }`

## Code

```js
const {x,z,y=63}=args;if(!Number.isInteger(x)||!Number.isInteger(z))throw Error('integer x,z required');const plan=[];const add=(dx,dy,dz,block,phase)=>plan.push({x:x+dx,y:y+dy,z:z+dz,block,phase});for(let dx=0;dx<5;dx++)for(let dz=0;dz<5;dz++)add(dx,0,dz,'cobblestone','floor');add(2,0,-1,'cobblestone','floor');for(let dy=1;dy<=3;dy++)for(let dx=0;dx<5;dx++)for(let dz=0;dz<5;dz++){if(dx!==0&&dx!==4&&dz!==0&&dz!==4)continue;if(dx===2&&dz===0&&dy<=2)continue;const c=(dx===0||dx===4)&&(dz===0||dz===4),w=dy===2&&(((dx===0||dx===4)&&dz===2)||(dx===2&&dz===4));add(dx,dy,dz,c?'spruce_log':w?'glass':'spruce_planks','wall');}for(const dy of [4,5])for(const dz of [0,4])for(let dx=dy===4?1:2;dx<=(dy===4?3:2);dx++)add(dx,dy,dz,'spruce_planks','gable');for(let l=0;l<3;l++)for(const dx of l===2?[2]:[l,4-l])for(const dz of [0,1,2,3,4,-1,5])add(dx,4+l,dz,'spruce_planks','roof');const empty=['air','cave_air','void_air','snow','short_grass','tall_grass'];async function nav(p){const r=await lib.navigate_to({...p,walkOnly:true,range:0});if(!r.ok)throw Error(JSON.stringify(r));}let placed=0;async function put(p){signal.check();const pos=new Vec3(p.x,p.y,p.z),b=bot.blockAt(pos);if(b?.name===p.block)return;if(!empty.includes(b?.name))throw Error('Occupied '+b?.name+' '+pos);if(b.name!=='air'&&b.name!=='cave_air'){await bot.dig(b);}let ref,face;for(const d of [new Vec3(0,-1,0),new Vec3(0,0,-1),new Vec3(0,0,1),new Vec3(1,0,0),new Vec3(-1,0,0),new Vec3(0,1,0)]){const n=bot.blockAt(pos.plus(d));if(n?.boundingBox==='block'){ref=n;face=d.scaled(-1);break;}}if(!ref)throw Error('No reference '+pos);const item=bot.inventory.items().find(i=>i.name===p.block);if(!item)throw Error('Missing '+p.block);if(bot.heldItem?.name===p.block)await bot.equip(bot.inventory.items().find(i=>i.name==='stone_sword')||bot.inventory.items().find(i=>i.name!==p.block),'hand');await bot.equip(item,'hand');await bot.lookAt(ref.position.offset(.5,.5,.5));bot.setControlState('sneak',true);try{await bot.placeBlock(ref,face);}finally{bot.setControlState('sneak',false);}if(bot.blockAt(pos)?.name!==p.block)throw Error('Unverified '+pos);placed++;if(placed%20===0)log({x,z,placed,phase:p.phase});}for(const p of plan.filter(p=>p.phase==='floor'||p.phase==='wall')){if(bot.blockAt(new Vec3(p.x,p.y,p.z))?.name===p.block)continue;const dx=p.x-x,dz=p.z-z;let sx,sz;if(dx<=1){sx=x-1;sz=p.z;}else if(dx>=3){sx=x+5;sz=p.z;}else{sx=p.x;sz=dz<0?z-2:dz<=2?z-1:z+5;}const sy=bot.blockAt(new Vec3(sx,y,sz))?.boundingBox==='block'?y+1:y;await nav({x:sx,y:sy,z:sz});await put(p);}const scaffold=[{x:x+2,y:y+1,z:z+1},{x:x+2,y:y+1,z:z+2},{x:x+2,y:y+2,z:z+2}];await nav({x:x+1,y:y+1,z:z+1});for(const p of scaffold)await put({...p,block:'cobblestone'});await nav({x:x+2,y:y+3,z:z+2});for(const p of plan.filter(p=>p.phase==='gable'||p.phase==='roof'))await put(p);for(const p of [...scaffold].reverse()){const b=bot.blockAt(new Vec3(p.x,p.y,p.z));if(b?.name==='cobblestone'){await lib.equip_item({item:'stone_pickaxe'});await bot.dig(b);}}await nav({x:x+2,y:y+1,z:z+1});await put({x:x+2,y:y+1,z,block:'spruce_door'});await put({x:x+1,y:y+1,z:z+1,block:'torch'});const missing=plan.filter(p=>bot.blockAt(new Vec3(p.x,p.y,p.z))?.name!==p.block);await lib.save_location({name:'village_cabin_'+x+'_'+z,x:x+2,y:y+1,z:z+2,note:'5x5 timber village cabin with pitched roof'});return {placed,missing,door:bot.blockAt(new Vec3(x+2,y+1,z))?.name,doorTop:bot.blockAt(new Vec3(x+2,y+2,z))?.name,torch:bot.blockAt(new Vec3(x+1,y+1,z+1))?.name};
```
