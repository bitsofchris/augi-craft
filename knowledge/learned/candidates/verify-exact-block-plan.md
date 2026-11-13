---
id: verify-exact-block-plan
title: Verify exact block plan
description: Read-only verification of each planned block's exact material; use after construction and navigation to detect disturbed earlier work.
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.verifyExactBlockPlan({plan:[{x,y,z,block}]})"
status: candidate
source:
  origin: learned
  created: 2026-11-12T23:38:48.651Z
  updated: 2026-11-12T23:38:48.651Z
version: 1
evidence:
  - episode: 2026-11-12-23-38-40
    outcome: success
    note: created from episode
    date: 2026-11-12T23:38:48.652Z
stats:
  successes: 1
  failures: 0
failure_modes: []
tags:
  - agent
  - builder
  - shared
---

Read-only verification of each planned block's exact material; use after construction and navigation to detect disturbed earlier work.

Args: `{plan:[{x,y,z,block}]}`

## Code

```js
let verified=0;const missing=[];for(const p of args.plan){const actual=bot.blockAt(new Vec3(p.x,p.y,p.z))?.name;if(actual===p.block)verified++;else missing.push({...p,actual});}return {verified,total:args.plan.length,missing};
```
