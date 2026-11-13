---
id: gather-stone
title: Gather stone
description: Mine cobblestone with a pickaxe for stone tools, a furnace and building blocks.
kind: plan
level: 1
when:
  - need cobblestone, stone tools, or a furnace
  - have a wooden pickaxe and no stone pickaxe
prerequisites:
  - any pickaxe in inventory
depends_on:
  tools: [find_blocks, gather_blocks, equip_item, craft_item]
  skills: [acquire-starter-tools]
implementation: "plan: follow the Procedure in a program using lib actions"
status: seed
source: { origin: "seed:diamond-quest", version: 1, author: augi-craft }
version: 1
evidence: []
failure_modes:
  - gather_blocks returns missing_tool without a pickaxe; stone dropped by hand yields nothing.
  - Stone may be under dirt; exposed stone is common on hillsides, cliffs and in caves.
tags: [stone, cobblestone, stone_pickaxe, furnace]
---

## Procedure

1. `lib.find_blocks({block: "stone"})`. If not found nearby, look for hills or dig down a few blocks (see **explore-underground-safely**).
2. `lib.gather_blocks({block: "cobblestone", count: 11})` — 3 for a stone pickaxe, 8 for a furnace. (The tool equips the best pickaxe automatically.)
3. `lib.craft_item({item: "stone_pickaxe"})`; optionally `stone_axe`, `stone_sword`.
4. `lib.craft_item({item: "furnace"})` when 8 cobblestone are spare.
