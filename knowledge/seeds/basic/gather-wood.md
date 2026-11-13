---
id: gather-wood
title: Gather wood
description: Find the nearest trees and collect logs, the root resource of the tech tree.
kind: plan
level: 1
when:
  - need logs, planks, sticks, a crafting table or wooden tools
  - inventory has no wood at the start of a world
prerequisites:
  - trees within ~64 blocks (otherwise explore first)
depends_on:
  tools: [observe, find_blocks, gather_blocks]
  skills: []
implementation: "plan: follow the Procedure in a program using lib actions"
status: seed
source: { origin: "seed:basic", version: 1, author: augi-craft, inspired_by: "Voyager mineWoodLog; mindcraft collectBlock" }
version: 1
evidence: []
failure_modes:
  - No trees nearby (find_blocks returns not_found) -> walk 30-50 blocks in one direction with navigate_to and retry.
  - Tall trees leave unreachable logs; gather_blocks skips them after repeated path errors.
  - Collecting logs from different species gives mixed planks; recipes accept any plank type.
tags: [wood, log, early-game]
---

## Procedure

1. `observe` — note any `notable.log` entry and current log counts.
2. If no log is listed, `lib.find_blocks({block: "log", maxDistance: 64})`.
3. `lib.gather_blocks({block: "log", count: N})` (N = 4 is enough for a crafting table + wooden pickaxe + wooden axe).
4. Verify: `changes.inventory` shows +N of some `*_log`. If `partial`, call again or move to a new area.

## Notes

- One log crafts into 4 planks. Budget: table 4 planks, 4 sticks 2 planks, each wooden tool 3 planks + 2 sticks.
