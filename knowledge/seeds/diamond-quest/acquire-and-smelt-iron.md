---
id: acquire-and-smelt-iron
title: Acquire and smelt iron
description: Mine iron ore with a stone pickaxe and smelt raw iron into ingots for an iron pickaxe.
kind: plan
level: 1
when:
  - need iron ingots, an iron pickaxe, a bucket or iron armor
  - have a stone pickaxe and want to progress toward diamonds
prerequisites:
  - stone pickaxe or better
  - a furnace (or 8 cobblestone) and fuel (coal preferred; planks/logs work)
depends_on:
  tools: [find_blocks, gather_blocks, smelt_item, craft_item]
  skills: [gather-stone, explore-underground-safely]
implementation: "plan: compose the dependent skills"
status: seed
source: { origin: "seed:diamond-quest", version: 1, author: augi-craft, inspired_by: "Voyager smeltRawIron, mineflayer smeltItem" }
version: 1
evidence: []
failure_modes:
  - Iron ore mined with a wooden pickaxe drops nothing (missing_tool).
  - Smelting "iron_ore" instead of "raw_iron" — ore blocks drop raw_iron in 1.17+.
  - Fuel shortage — each coal smelts 8 items, each plank or log 1.5.
tags: [iron, raw_iron, iron_ingot, iron_pickaxe, smelting]
---

## Procedure

1. `lib.find_blocks({block: "iron", maxDistance: 64})` — iron ore is common in exposed caves and mountains, y 0-64.
2. Also grab `coal` if visible: `lib.gather_blocks({block: "coal", count: 3})`.
3. `lib.gather_blocks({block: "iron", count: 3})` → expect +3 raw_iron.
4. `lib.smelt_item({item: "raw_iron", count: 3})` (places a furnace from inventory if none nearby).
5. `lib.craft_item({item: "iron_pickaxe"})` (3 iron_ingot + 2 sticks).
