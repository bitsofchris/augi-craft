---
id: generate-poppies-and-dandelions-with-leaf-compost
title: Generate poppies and dandelions with leaf compost
description: Snowy base flower supply using spruce leaves and bone meal on grass.
kind: strategy
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
  created: 2026-11-13T00:23:22.314Z
  updated: 2026-11-13T00:23:22.314Z
version: 1
evidence:
  - episode: 2026-11-13-00-23-09
    outcome: success
    note: created from episode
    date: 2026-11-13T00:23:22.315Z
stats:
  successes: 1
  failures: 0
failure_modes: []
tags:
  - flowers
  - farming
  - shared
---

## Procedure

Shear accessible spruce leaves, checking shears inventory and equip success before each dig. Compost carried leaves with helpers.compostLeavesAtBlock at a verified composter. Apply bone meal to grass_block with air above within reach. Collect only required flower species and verify inventory pickup. Repeat until target counts. Deliver with give_items and verify received count; recover dropped partial transfers.

## Notes

Roughly 30 leaves per bone meal; flower yield is random.
