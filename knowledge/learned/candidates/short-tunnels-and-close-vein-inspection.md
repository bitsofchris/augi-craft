---
id: short-tunnels-and-close-vein-inspection
title: Short tunnels and close vein inspection
description: Preserve iron durability with spare stone picks and inspect ore encounters from nearby tunnel checkpoints.
kind: plan
level: 2
when:
  - searching for first diamonds with an iron pickaxe
prerequisites:
  - saved base with chest
  - iron pickaxe and spare stone pickaxes
  - building blocks for return climbs
depends_on:
  tools:
    - navigate_to
    - observe
    - gather_blocks
    - save_location
    - stop_action
  skills:
    - explore-underground-safely
    - collect-valuable-ore-on-mining-trips
    - establish-resource-storage
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T14:30:57.588Z
  updated: 2026-10-12T14:30:57.588Z
version: 1
evidence:
  - episode: 2026-10-12-14-29-51
    outcome: success
    note: created from episode
    date: 2026-10-12T14:30:57.589Z
  - episode: 2026-10-12-17-06-33
    outcome: success
    note: Close revisit completed first coal vein;16 verified coal.
    date: 2026-10-12T17:18:48.133Z
stats:
  successes: 2
  failures: 0
failure_modes:
  - A failed goto can leave movement active in older runtime versions; stop_action before revising
  - Long routes can time out; shorten waypoints
  - No visible ore at tunnel endpoint does not mean the entire segment has no ore
tags:
  - diamonds
  - tunneling
  - durability
---

## Procedure

Descend using short coordinate waypoints and save depth checkpoints. Preserve iron pickaxe durability for diamonds and gold. At the mining layer, tunnel about8-10 blocks per step and observe. After any ore pickup during navigation, walk back through that short segment and inspect close to the encounter; endpoint visibility can miss side veins. Gather exposed valuable ores and verify inventory after a partial result. Return through saved checkpoints before tools run low and deposit diamonds at base.
