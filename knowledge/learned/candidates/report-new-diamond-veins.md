---
id: report-new-diamond-veins
title: Report new diamond veins
description: "Player preference: announce each new diamond vein once in Minecraft chat, including current diamond inventory total."
kind: strategy
level: 2
when:
  - a new diamond vein is found during mining
prerequisites: []
depends_on:
  tools:
    - observe
    - gather_blocks
    - say
  skills:
    - collect-valuable-ore-on-mining-trips
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T14:46:39.829Z
  updated: 2026-10-12T14:46:39.829Z
version: 1
evidence:
  - episode: 2026-10-12-17-15-08
    outcome: success
    note: Applied once-per-vein reporting to coal and iron per current assignment; inventory totals verified.
    date: 2026-10-12T17:18:50.714Z
stats:
  successes: 1
  failures: 0
failure_modes: []
tags:
  - diamonds
  - chat
  - player-preference
---

## Procedure

Collect the exposed vein and verify diamond inventory with observe. Send one say message naming the new vein, the number collected and the current diamond inventory total. Do not announce each ore block. Track already reported veins by their approximate coordinates in the episode to avoid duplicate announcements. If collecting fails, report discovery and the unchanged verified inventory without claiming collection.

## Notes

From an explicit player request.
