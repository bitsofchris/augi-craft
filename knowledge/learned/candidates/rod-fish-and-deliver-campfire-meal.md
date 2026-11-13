---
id: rod-fish-and-deliver-campfire-meal
title: Catch fish with a rod, cook on a campfire and deliver
description: Compose rod crafting, bounded fishing, campfire cooking and base delivery. Fishing awaits live verification.
kind: plan
level: 2
when:
  - asked to catch and cook a specific number of fish
prerequisites:
  - Fishing rod or3sticks2string at a craftingtable
  - Safe open-water bank, free inventory space and campfire
depends_on:
  tools:
    - observe
    - craft_item
    - fish_once
    - attack_mob
    - cook_campfire
    - navigate_to
    - deposit_items
    - say
  skills:
    - cook-food-on-confirmed-campfire
    - craft-tools-with-confirmed-inventory
    - return-to-base-open-door-and-deposit
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T20:41:17.447Z
  updated: 2026-10-12T20:41:17.447Z
version: 1
evidence:
  - episode: 2026-10-12-20-40-25
    outcome: success
    note: created from episode
    date: 2026-10-12T20:41:17.448Z
stats:
  successes: 1
  failures: 0
failure_modes:
  - Missing string or Peaceful blocks spider route.
  - "Iced water, blocked bank, no pickup or full inventory: resolve before retrying."
  - Do not count treasure/noncookable fish toward a cooked-fish target.
tags:
  - fishing
  - food
  - campfire
  - delivery
---

## Procedure

Observe inventory; obtain2string legitimately. Hunt observed spiders with lib.attack_mob if difficulty permits; Peaceful requires natural cobwebs/loot or a user difficulty change. Craft fishing_rod and verify output. Note initial cod/salmon. From safe footing2–7blocks from visible open water with air above, call lib.fish_once for one bounded cast. Repeat until newly collected cod+salmon reaches the order count. Bycatch and killed fish do not meet this target. Inspect and revise after timeouts or missing pickup. Cook separately by species in batches1–4 using lib.cook_campfire at an empty lit station from safe adjacent footing. Verify actual cooked counts. Return using saved entrance and open doors, deposit the requested cooked fish into assigned chest, announce counts and location.

## Notes

Unverified candidate plan; unit tests pass but no rod/string available and0/10 fish caught. Live campfire success was chicken only. Requires live fishing and fish-cooking verification.
