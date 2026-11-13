---
id: diamond-quest-roadmap
title: Diamond quest roadmap
description: Tech-tree guidance from bare hands to mining diamonds, as a sequence of composable subgoals.
kind: plan
level: 1
when:
  - choosing the next subgoal toward diamonds
  - unsure what is achievable with the current inventory
depends_on:
  tools: [observe]
  skills: [gather-wood, acquire-starter-tools, gather-stone, acquire-and-smelt-iron, explore-underground-safely, establish-resource-storage]
prerequisites: []
implementation: "plan: pick the first unmet milestone"
status: seed
source: { origin: "seed:diamond-quest", version: 1, author: augi-craft }
version: 1
evidence: []
failure_modes:
  - Skipping tiers: diamond ore mined with less than an iron pickaxe drops nothing.
tags: [diamonds, curriculum, roadmap, progression]
---

## Milestones (pick the first one not yet met)

1. Logs ≥ 4 → **gather-wood**
2. Wooden pickaxe → **acquire-starter-tools**
3. Stone pickaxe + furnace → **gather-stone**
4. Iron pickaxe → **acquire-and-smelt-iron**
5. Diamond ore found → **explore-underground-safely** (y ≈ -59)
6. Diamonds mined → `lib.gather_blocks({block: "diamond"})` with an iron pickaxe equipped
7. Stockpile → **establish-resource-storage**, repeat 5-6

This is guidance, not a program: each milestone is achieved by composing smaller skills.
