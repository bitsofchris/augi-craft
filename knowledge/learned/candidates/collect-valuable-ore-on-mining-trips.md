---
id: collect-valuable-ore-on-mining-trips
title: Collect valuable ore on mining trips
description: "Standing player preference: collect visible iron, gold and diamonds during the diamond quest, keeping iron for replacement tools."
kind: strategy
level: 2
when:
  - mining or exploring underground
prerequisites:
  - stone pickaxe for iron; iron pickaxe for gold and diamonds
depends_on:
  tools:
    - observe
    - find_blocks
    - gather_blocks
    - deposit_items
  skills:
    - acquire-and-smelt-iron
    - explore-underground-safely
    - establish-resource-storage
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T14:28:05.883Z
  updated: 2026-10-12T14:28:05.883Z
version: 1
evidence:
  - episode: 2026-10-12-14-38-34
    outcome: success
    note: "First completed trip: six diamonds and two raw iron deposited; no gold encountered."
    date: 2026-10-12T14:38:51.929Z
stats:
  successes: 1
  failures: 0
failure_modes: []
tags:
  - mining
  - diamonds
  - iron
  - gold
  - player-preference
---

## Procedure

At each short tunnel segment, inspect for visible iron, gold and diamond ore. Gather reachable veins using the required pickaxe, checking health, lava and durability. Reserve iron pickaxe durability for gold and diamonds; use stone for ordinary tunneling and iron. Keep enough iron for replacement tools. Return to the saved base and deposit valuables when tools or inventory run low.

## Notes

Explicit player instruction on 2026-10-12. This preference is saved; the full collection-and-return procedure still needs live validation.
