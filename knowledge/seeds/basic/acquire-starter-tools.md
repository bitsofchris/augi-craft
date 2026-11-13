---
id: acquire-starter-tools
title: Acquire starter tools
description: Turn about 4 logs into a crafting table, sticks, a wooden pickaxe and a wooden axe.
kind: plan
level: 1
when:
  - need a pickaxe or axe and have none
  - start of a new world after gathering wood
prerequisites:
  - 4 logs (or 12+ planks), fewer if a crafting table already exists
depends_on:
  tools: [observe, craft_item]
  skills: [gather-wood, craft-planks-and-sticks, build-crafting-station]
implementation: "plan: compose the dependent skills"
status: seed
source: { origin: "seed:basic", version: 1, author: augi-craft, inspired_by: "Voyager curriculum: wood -> wooden pickaxe -> stone" }
version: 1
evidence: []
failure_modes:
  - Running out of planks: crafting table 4 + sticks 2 + pickaxe 3 + axe 3 = 12 planks = 3 logs; gather 4 to be safe.
  - craft_item for tools returns no_station if no crafting table is nearby or in inventory.
tags: [tools, wooden_pickaxe, wooden_axe, early-game]
---

## Procedure

1. `observe`. If fewer than 4 logs (and no planks), run **gather-wood** for 4 logs.
2. **craft-planks-and-sticks**: 16 planks, then 4 sticks.
3. **build-crafting-station** if none is nearby.
4. `lib.craft_item({item: "wooden_pickaxe"})` then `lib.craft_item({item: "wooden_axe"})`.
5. Verify: inventory shows `wooden_pickaxe: 1`, `wooden_axe: 1`.
6. Next step on the tech tree: **gather-stone** (needs the pickaxe) for stone tools.
