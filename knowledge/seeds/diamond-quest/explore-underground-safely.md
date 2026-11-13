---
id: explore-underground-safely
title: Explore underground safely
description: Descend toward ore layers in bounded steps while watching health, light and lava.
kind: strategy
level: 1
when:
  - searching for iron, coal, redstone or diamond ore below ground
  - find_blocks cannot see the ore from the surface
prerequisites:
  - stone pickaxe or better; iron pickaxe for diamonds
  - some food and spare cobblestone blocks
depends_on:
  tools: [observe, find_blocks, navigate_to, gather_blocks, place_block, save_location]
  skills: [gather-stone]
implementation: "plan: follow the Procedure in a program using lib actions"
status: seed
source: { origin: "seed:diamond-quest", version: 1, author: augi-craft }
version: 1
evidence: []
failure_modes:
  - Digging straight down into lava or a cave drop; prefer staircase descents.
  - Getting lost; save_location at the entrance and every 20 blocks of depth.
  - Health dropping during long trips; observe every few actions and retreat below 10 health.
tags: [mining, caves, underground, diamonds, safety]
---

## Procedure

1. `lib.save_location({name: "mine_entrance"})`.
2. Prefer existing caves: `lib.find_blocks({block: "cave_air"})` or walk into visible openings.
3. Descend in steps: `lib.navigate_to` a point ~8 blocks lower and away (pathfinder digs a staircase); `observe` after each step.
4. At each step, `lib.find_blocks` for target ores (iron y 0-64; diamonds deepest around y -59 in 1.18+).
5. If `observe.notable.lava` is within 4 blocks, stop and route around; place cobblestone to block flows.
6. Retreat with `lib.navigate_to({location: "mine_entrance"})` if health < 10 or the inventory is full.
