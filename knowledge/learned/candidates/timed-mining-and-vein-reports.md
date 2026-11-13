---
id: timed-mining-and-vein-reports
title: Timed ore mining with vein reports and verified return
description: Mine for a bounded interval, announce each distinct vein once with verified pickup totals, preserve harvesting tools and return to the authorized house chest.
kind: plan
level: 2
when:
  - player requests a timed coal/iron/diamond gathering trip
prerequisites:
  - known base chest and feasible return route
  - suitable picks, spare building blocks and food
depends_on:
  tools:
    - observe
    - navigate_to
    - find_blocks
    - gather_blocks
    - say
    - deposit_items
  skills:
    - short-tunnels-and-close-vein-inspection
    - navigate-and-repair-mine-stairs
    - collect-valuable-ore-on-mining-trips
    - craft-tools-with-confirmed-inventory
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T18:54:48.793Z
  updated: 2026-10-12T18:54:48.793Z
version: 1
evidence:
  - episode: 2026-10-12-18-53-40
    outcome: success
    note: created from episode
    date: 2026-10-12T18:54:48.796Z
stats:
  successes: 1
  failures: 0
failure_modes: []
tags:
  - mining
  - timed-job
  - veins
  - chat
  - delivery
---

## Procedure

1. Verify identity, inspect authorized supplies, and record withdrawals separately from new collection.
2. Prepare stone picks, iron pick if available, building blocks and food. Use current house coordinates rather than obsolete mine-camp chest notes.
3. Record wall-clock mining start/deadline after setup. Use short tunnels and visible-ore searches. Finish reachable ore in a distinct vein, observe net ore gain, and send ONE chat message with vein yield and current carried ore totals. Revisit segment side walls when a navigation pickup reveals ore; do not duplicate reports for the same vein.
4. Check health, food, inventory, tool durability and deadline between subgoals. Reserve iron for an iron pick before attempting diamonds. No discovery is guaranteed during a timed trip.
5. Stop expansion at deadline and return via verified checkpoints. Carry building blocks for stair recovery. Surface/house navigation is walkOnly; controlled mining movement is authorized underground. Inspect real door geometry; report a lib.navigate_to bug if open-door path nodes aim atop panels.
6. Deposit the requested resources at the exact authorized chest. Verify deposit result plus inventory delta. Collected, consumed for tools/torches, retained and delivered are different totals.
7. Record complete or partial outcome honestly, including missing ore and failed or pending delivery. Never label carried ore as delivered.

## Notes

One live trip verified the return and the vein reports; a complete delivery cycle is still unverified.
