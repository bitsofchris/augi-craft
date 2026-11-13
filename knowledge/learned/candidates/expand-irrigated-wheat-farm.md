---
id: expand-irrigated-wheat-farm
title: Expand irrigated wheat farm
description: Collect grass seeds, terrace natural soil beside saved farm water and plant only hydrated plots. Verified expansion from 3 to 20 crops.
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.expandIrrigatedWheatFarm({seedTarget=32,seconds=750})"
status: candidate
source:
  origin: learned
  created: 2026-10-18T15:17:20.209Z
  updated: 2026-10-18T15:17:20.209Z
version: 1
evidence:
  - episode: 2026-10-18-15-17-20
    outcome: success
    note: created from episode
    date: 2026-10-18T15:17:20.210Z
stats:
  successes: 1
  failures: 0
failure_modes: []
tags:
  - hunter
  - food
  - farming
---

Collect grass seeds, terrace natural soil beside saved farm water and plant only hydrated plots. Verified expansion from 3 to 20 crops.

Args: `{seedTarget=32,seconds=750}`

## Code

```js
const {seedTarget=32,seconds=750}=args;
const end=Date.now()+seconds*1000;
const n=name=>bot.inventory.items().filter(i=>i.name===name).reduce((s,i)=>s+i.count,0);
const farmResult=await lib.recall_location({name:'farm'});
const fp=farmResult.observations.location.position;
const center=new Vec3(fp.x,fp.y,fp.z);
const ids=['short_grass','grass','tall_grass','fern','large_fern'].map(n=>bot.registry.blocksByName[n]?.id).filter(x=>x!==undefined);
await bot.unequip('hand');
const skipped=new Set();let broken=0;let walks=0;
while(n('wheat_seeds')<seedTarget && Date.now()<end-150000){
 signal.check();
 const found=bot.findBlocks({matching:ids,maxDistance:64,count:256}).filter(p=>!skipped.has(p.toString()));
 const p=found[0];
 if(!p){
   if(walks>=8)break;
   const a=walks*2.4,r=32+12*walks++;
   const go=await lib.navigate_to({x:Math.round(center.x+r*Math.cos(a)),y:Math.floor(bot.entity.position.y),z:Math.round(center.z+r*Math.sin(a)),range:3,walkOnly:true});
   log('grass search '+go.summary);continue;
 }
 skipped.add(p.toString());
 try{
 const go=await lib.navigate_to({x:p.x,y:p.y,z:p.z,range:1,walkOnly:true});
 if(!go.ok||bot.entity.position.distanceTo(p)>4.5)continue;
 const block=bot.blockAt(p);
 if(!ids.includes(block?.type))continue;
 await bot.dig(block);broken++;
 bot.pathfinder.setGoal(new goals.GoalNear(p.x,p.y,p.z,0));
 await sleep(450);bot.pathfinder.setGoal(null);
 if(broken%16===0)log('grass '+broken+'; seeds '+n('wheat_seeds'));
 }catch(e){log('grass failed '+e.message);}
}
log('gathered seeds '+n('wheat_seeds')+' from '+broken+' grass');
await lib.navigate_to({x:center.x,y:center.y+1,z:center.z,range:3,walkOnly:true});
const wet=p=>{for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++)for(const y of [0,1])if(bot.blockAt(p.offset(x,y,z))?.name==='water')return true;return false;};
await bot.unequip('hand');
let lowered=0;
for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++){
 const p=center.offset(x,0,z),b=bot.blockAt(p),a=bot.blockAt(p.offset(0,1,0)),below=p.offset(0,-1,0);
 if(!['dirt','grass_block'].includes(b?.name)||!['air','snow','short_grass','fern'].includes(a?.name)||!['dirt','grass_block'].includes(bot.blockAt(below)?.name)||!wet(below))continue;
 if(Date.now()>end-30000)break;
 const go=await lib.navigate_to({x:p.x,y:p.y+1,z:p.z,range:3,walkOnly:true});if(!go.ok)continue;
 if(bot.entity.position.floored().offset(0,-1,0).equals(p))continue;
 try{if(a.name!=='air')await bot.dig(bot.blockAt(p.offset(0,1,0)));await bot.dig(bot.blockAt(p));lowered++;}catch(e){log('terrace '+e.message);}
}
log('lowered irrigated soil '+lowered);
const sites=[];
for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++)for(let y=-1;y<=1;y++){
 const p=center.offset(x,y,z),b=bot.blockAt(p),above=bot.blockAt(p.offset(0,1,0));
 if(['farmland','dirt','grass_block'].includes(b?.name)&&['air','snow','short_grass','fern'].includes(above?.name)&&wet(p))sites.push(p);
}
sites.sort((a,b)=>a.distanceTo(center)-b.distanceTo(center));
let planted=0,tilled=0;
for(const p of sites){
 if(!n('wheat_seeds')||Date.now()>end)break;
 signal.check();
 try{
 const go=await lib.navigate_to({x:p.x,y:p.y+1,z:p.z,range:3,walkOnly:true});if(!go.ok)continue;
 let b=bot.blockAt(p);const above=bot.blockAt(p.offset(0,1,0));if(above.name!=='air')await bot.dig(above);
 if(b.name!=='farmland'){
 const hoe=bot.inventory.items().find(i=>i.name.endsWith('_hoe'));if(!hoe)break;
 await bot.equip(hoe,'hand');await bot.activateBlock(b);await sleep(250);
 if(bot.blockAt(p)?.name!=='farmland')continue;tilled++;
 }
 const seed=bot.inventory.items().find(i=>i.name==='wheat_seeds');if(!seed)break;
 await bot.equip(seed,'hand');await bot.activateBlock(bot.blockAt(p),new Vec3(0,1,0));await sleep(250);
 if(bot.blockAt(p.offset(0,1,0))?.name==='wheat')planted++;
 log('planted '+planted);
 }catch(e){log('plant failed '+e.message);}
}
let crops=0;for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++)for(let y=-1;y<=2;y++)if(bot.blockAt(center.offset(x,y,z))?.name==='wheat')crops++;
return {broken,seeds:n('wheat_seeds'),tilled,planted,crops,health:bot.health,food:bot.food};
```

## Notes

Only run when player authorizes expansion around saved farm. Unequip tools before clearing grass/soil. Hunger and nighttime mobs can interrupt. Planting can trample crops, verify final crop count.
