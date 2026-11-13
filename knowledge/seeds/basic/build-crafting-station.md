---
id: build-crafting-station
title: Build a crafting station
description: Craft and place a crafting table so 3x3 recipes (tools, furnace, chest) become available.
kind: plan
level: 1
when:
  - craft_item fails with no_station
  - about to craft tools, a furnace or a chest and no crafting table is nearby
prerequisites:
  - 4 planks
depends_on:
  tools: [craft_item, place_block, save_location]
  skills: [craft-planks-and-sticks]
implementation: "plan: follow the Procedure in a program using lib actions"
status: seed
source: { origin: "seed:basic", version: 1, author: augi-craft, inspired_by: "mindcraft craftRecipe table placement" }
version: 1
evidence: []
failure_modes:
  - place_block finds no free spot when standing on uneven terrain or in water; move to flat ground first.
  - Forgetting where the table is; save its location as "crafting_table".
tags: [crafting_table, station, early-game]
---

## Procedure

1. If `observe` shows `notable.crafting_table` within 16 blocks, you are done.
2. `lib.craft_item({item: "crafting_table"})` (4 planks, 2x2 grid).
3. Optional: `lib.place_block({item: "crafting_table"})`. (lib.craft_item will place it automatically when a 3x3 recipe needs it.)
4. `lib.save_location({name: "crafting_table"})` so you can return.
