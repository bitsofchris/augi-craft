---
id: navigate-and-repair-mine-stairs
title: Navigate and repair mine stairs
description: Climb mine tunnels using one-block steps, inventory footholds and jump headroom; diagnose server corrections instead of repeatedly timing out.
kind: plan
level: 2
when:
  - returning through a mined tunnel
  - navigation stalls at a stair or ledge
prerequisites:
  - spare solid building blocks
  - appropriate pickaxe
  - saved return checkpoints
depends_on:
  tools:
    - observe
    - navigate_to
    - inspect_navigation
    - step_to
    - dig_block
    - place_block
    - stop_action
  skills:
    - short-tunnels-and-close-vein-inspection
    - explore-underground-safely
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T15:36:47.706Z
  updated: 2026-10-12T15:36:47.706Z
version: 1
evidence:
  - episode: 2026-10-12-15-36-16
    outcome: success
    note: created from episode
    date: 2026-10-12T15:36:47.708Z
  - episode: 2026-10-12-21-00-59
    outcome: failure
    note: Two visible obstructions cleared and ascent46to52 verified, but full escape remains unreachable by walking; bounded recovery stopped. Do not treat saved checkpoints as proven reversible routes.
    date: 2026-10-12T21:01:16.269Z
stats:
  successes: 1
  failures: 1
failure_modes:
  - Two-block rises require an intermediate step
  - Two-block-high lower corridors can block the jump even when destination body space is clear
  - A near goal can finish while airborne; observe again after settling
  - Missing building blocks can strand the return route
  - Server position corrections can mimic headroom trouble
tags:
  - navigation
  - tunnels
  - stairs
  - headroom
  - recovery
---

## Procedure

1. Observe position, health and building-block reserve. Navigate through short saved depth checkpoints, checking the settled position after each.
2. Ascend only one block per step. For a two-block ledge, place an intermediate solid foothold from inventory where it leaves a safe route; never expect a two-block jump.
3. Keep two body blocks above the destination footing clear. For jumping, the lower takeoff column needs enough overhead space for the player's 1.25-block jump; clear a third air block above the lower feet when necessary. Use lib.dig_block only for visible reachable obstructions, avoiding gravel, fluids and removing support beneath the player.
4. If stationary, stop_action and lib.inspect_navigation. Check the first planned node, footing, toBreak/toPlace and jump simulation. A successful simulation is not proof of live success.
5. Use lib.step_to for a single adjacent, safe rise or descent and inspect its server corrections. Repeated correction at an unobstructed stair can indicate a runtime collision/protocol issue. Native 26.3 requires Java float entity dimensions; the runtime fix is installed. Do not repeatedly retry the same failed route without new evidence.
6. Continue in bounded checkpoint segments, collecting exposed valuable ore. Verify health and inventory, deposit at the explicit base chest, then stop when asked to remain there.

## Notes

Live evidence verifies ascending and placing footholds, not a full independent descent test. Candidate remains unvalidated. After native 26.3 float-dimension fix, the same failed jump completed with zero server corrections.

The complete return consumed 59 cobblestone. Some placements formed vertical
columns: inspecting the reverse path showed digging would be required to
descend them. Treat those as escape footholds. A permanent route should use
horizontal offsets between one-block rises and must be tested in both
directions before calling it a reusable staircase. Do not remove support
under the player merely to test descent.
