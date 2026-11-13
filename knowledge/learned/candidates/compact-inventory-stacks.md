---
id: compact-inventory-stacks
title: Compact inventory stacks
description: Merge matching partial inventory stacks to recover slots between native crafting batches.
kind: program
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "helper program: helpers.compactInventoryStacks({})"
status: candidate
source:
  origin: learned
  created: 2026-10-20T22:26:09.204Z
  updated: 2026-10-20T22:26:09.204Z
version: 1
evidence:
  - episode: 2026-10-20-22-25-58
    outcome: success
    note: created from episode
    date: 2026-10-20T22:26:09.205Z
  - episode: 2026-10-20-22-37-03
    outcome: success
    note: Four plank crafting batches completed with compaction between batches.
    date: 2026-10-20T22:37:19.342Z
stats:
  successes: 2
  failures: 0
failure_modes: []
tags:
  - agent
  - builder
  - shared
---

Merge matching partial inventory stacks to recover slots between native crafting batches.

Args: `{}`

## Code

```js
let moved=0;for(let s=9;s<45;s++){const a=bot.inventory.slots[s];if(!a)continue;const d=bot.inventory.slots.findIndex((b,i)=>i>=9&&i<s&&b?.name===a.name&&b.count+a.count<=a.stackSize);if(d>=0){await bot.moveSlotItem(s,d);moved++;}}return {moved,empty:bot.inventory.emptySlotCount()};
```
