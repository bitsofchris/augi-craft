---
id: return-to-base-open-door-and-deposit
title: Return to base, open the door and deposit resources
description: Use verified entrance and interior waypoints, explicitly open wooden doors, enter the house, and verify delivery into the assigned base chest without terrain edits.
kind: plan
level: 2
when:
  - finished hunting, mining or gathering and need to deliver
  - asked to return home or put resources in the base chest
  - base route stalls at a doorway or beside storage
prerequisites:
  - Know the assigned base/chest and entrance route in the current dimension
  - Runtime loaded with open-door planning and floor-level path waypoint repair; chest approaches must use walkOnly
depends_on:
  tools:
    - observe
    - recall_location
    - inspect_door
    - navigate_to
    - set_door
    - deposit_items
    - say
    - step_to
  skills:
    - recover-from-blocked-progress
    - deliver-items-to-player
    - establish-resource-storage
implementation: "plan: follow the Procedure in a program using lib actions"
status: validated
source:
  origin: learned
  created: 2026-10-12T17:04:42.662Z
  updated: 2026-10-12T17:04:42.662Z
  promoted: 2026-10-12T17:05:04.022Z
version: 1
evidence:
  - episode: 2026-10-12-17-03-34
    outcome: success
    note: created from episode
    date: 2026-10-12T17:04:42.663Z
  - episode: 2026-10-12-17-03-38
    outcome: success
    note: Separate full cycle from outside via closed south door to interior;28cobblestone deposited with exact removal.
    date: 2026-10-12T17:04:59.451Z
stats:
  successes: 2
  failures: 0
failure_modes:
  - A stale base note can point to the old mine camp; use current saved base/chest and verified entrance
  - Open wooden doors still fail on the old planner or its top-of-panel waypoints; reload the repaired runtime
  - Approximate coordinates, wall blocks and chest tops are not interior arrival squares
  - Deposits must use the assigned chest and verify actual quantities; do not announce intent as delivery
  - An iron or blocked door is not fixed by direct wooden-door interaction
tags:
  - return
  - base
  - home
  - doors
  - doorway
  - chest
  - deposit
  - delivery
  - navigation
  - walkOnly
---

## Procedure

1. Observe identity, current dimension and inventory. Recall base, base_entrance, base_door, base_inside and base_chest. Plan resource quantities to deliver while retaining required equipment and personal travel supplies. Stop if the route or chest assignment is unknown; do not choose an arbitrary nearby chest.
2. Travel to the verified entrance using lib.navigate_to location base_entrance, range0, walkOnly true. For distant travel use bounded segments as chunks load, preserving the final entrance destination. Approximate base coordinates identify an area and are not a path through walls.
3. If the building has changed or a doorway is unclear, use lib.inspect_door on an observed nearby lower door. Read actual facing, open state, floor and feet/head clearance. Select a clear approach square and an interior square on opposite sides of the doorway, then save verified waypoints. Never break a wall or stand on storage as the normal approach.
4. At the entrance call lib.set_door with open true for each required wooden door. It is idempotent: already-open is success. Verify observed open state before crossing. For double doors ensure the selected passage is open; both were checked in the live test. Iron doors require the existing redstone control and are outside the direct wooden-door interaction.
5. Navigate to base_inside with range0 and walkOnly true. Verify actual floor-level interior position after movement stops. Do not call arrival successful merely because the door opened. A closed door, obstructed opening or stale runtime requires recovery rather than more movement retries.
6. Deposit each planned resource using lib.deposit_items with the explicit base_chest coordinates and count (omit count only when all of that item is intended). Verify exact changes.inventory removal, observations.deposited and chest contents. Chest access must remain non-destructive. If too far, use the verified clear base_unload standing square; do not climb onto chests. Preserve required tools. Full or inaccessible chest means report the exact undelivered inventory.
7. Observe after delivery, announce delivered items and chest coordinates in chat, and wait at base_inside when asked to stay. Leave doors in the player-requested state; do not automatically close a powered door or trap another player.
8. On a stall stop_action, inspect the route/door, and revise a concrete cause. A chest-top position at fractional y63.875 may need a safe adjacent step to the clear platform before normal travel; this is recovery, not the default route. Never add a filler block or dig the house to get through.

## Notes

Verified live on 2026-10-12 against a base with lower spruce double doors and a
chest just inside. Every place this skill uses (`base`, `base_entrance`,
`base_inside`, `base_chest`, `base_unload`) is a saved location in the current
world's state, never a coordinate in the skill: recheck them when the house
changes. The pathfinder originally treated open door panels as solid and later
aimed at their tops; both were repaired in the runtime without changing
collision shapes. Live initial entry took about 1.6 seconds and delivered 36
cobbled deepslate from the interior; a second full cycle started outside,
opened a closed door, returned inside and delivered 28 cobblestone while
keeping 32. Existing worker MCP processes need a reload to pick up runtime
fixes. Surface and door delivery are proven here; a long-distance mine escape
composes its own tunnel route first.
