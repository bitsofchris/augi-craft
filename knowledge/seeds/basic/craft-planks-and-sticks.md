---
id: craft-planks-and-sticks
title: Craft planks and sticks
description: Convert logs into planks and planks into sticks in the 2x2 inventory grid (no table needed).
kind: plan
level: 1
when:
  - have logs and need planks or sticks
  - preparing materials for a crafting table or tools
prerequisites:
  - at least 1 log in inventory
depends_on:
  tools: [craft_item]
  skills: [gather-wood]
implementation: "plan: follow the Procedure in a program using lib actions"
status: seed
source: { origin: "seed:basic", version: 1, author: augi-craft }
version: 1
evidence: []
failure_modes:
  - Asking for "planks" fails; use the species name matching your logs, e.g. oak_planks from oak_log, birch_planks from birch_log.
  - craft_item counts outputs, not crafts; count 8 planks uses 2 logs.
tags: [planks, sticks, crafting, early-game]
---

## Procedure

1. `observe` to see which `*_log` you hold.
2. `lib.craft_item({item: "<species>_planks", count: 4 * logs_to_convert})`.
3. `lib.craft_item({item: "stick", count: 4})` (uses 2 planks).
4. Verify with `changes.inventory`: planks and sticks increased, logs decreased.
