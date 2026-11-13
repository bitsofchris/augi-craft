---
id: establish-resource-storage
title: Establish resource storage
description: Craft and place a chest at a saved base location, then deposit surplus items.
kind: plan
level: 1
when:
  - inventory is nearly full (observe.emptySlots < 5)
  - carrying valuable resources before a risky trip
prerequisites:
  - 8 planks for a chest, or an existing chest nearby
depends_on:
  tools: [craft_item, place_block, deposit_items, withdraw_items, save_location]
  skills: [build-crafting-station]
implementation: "plan: follow the Procedure in a program using lib actions"
status: seed
source: { origin: "seed:diamond-quest", version: 1, author: augi-craft, inspired_by: "mindcraft putInChest/takeFromChest" }
version: 1
evidence: []
failure_modes:
  - Depositing tools you still need; keep pickaxes, food and a few blocks.
  - Forgetting the base location; always save_location "base".
tags: [chest, storage, base, inventory]
---

## Procedure

1. `recall_location {name: "base"}`; if it exists, `lib.navigate_to({location: "base"})`.
2. Otherwise `lib.craft_item({item: "chest"})`, `lib.place_block({item: "chest"})`, `lib.save_location({name: "base", note: "storage chest"})`.
3. `lib.deposit_items` for each surplus stack (dirt, extra cobblestone, raw materials not needed now).
4. Record what was stored in the episode so future sessions know the contents.
