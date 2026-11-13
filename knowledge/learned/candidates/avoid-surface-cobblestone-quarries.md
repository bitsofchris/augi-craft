---
id: avoid-surface-cobblestone-quarries
title: Avoid surface cobblestone quarries
description: Bulk obtain_item cobblestone during surface prep can quarry a pit; prepare one stone pickaxe and collect stone through the staircase instead.
kind: lesson
level: 2
when: []
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "plan: follow the Procedure section in a program"
status: candidate
source:
  origin: learned
  created: 2026-10-17T20:06:58.981Z
  updated: 2026-10-17T20:06:58.981Z
version: 1
evidence: []
stats:
  successes: 0
  failures: 0
failure_modes:
  - Bulk cobblestone obtain_item at the surface digs nearby stone into a pit.
tags:
  - diamond
  - gatherer
  - mining
---

## Procedure

An operator observed a 4x4 pit caused by mineForDiamonds surface prep calling obtain_item for 32 cobblestone, which digs the nearest stone. Surface prep must be only crafting_table 1, stick 16, stone_pickaxe 1 (three cobblestone required). Do not bulk-gather surface cobblestone, prepare 12 torches, or batch three stone pickaxes. Descend with a 1-wide, 2-high staircase and mine 1x2 tunnels; never quarry a pit or dig straight down. The staircase yields cobblestone, and equipFor already crafts replacement pickaxes. Follow agents/crew/diamond.md Digging shape. Updated helper awaits verification on the next trip.
