---
id: cook-food-on-confirmed-campfire
title: Cook food on a campfire and collect confirmed outputs
description: Craft a campfire using coal or charcoal, cook bounded batches from safe adjacent footing, verify pickup and deliver cooked food.
kind: plan
level: 2
when:
  - asked to cook food on a campfire
prerequisites:
  - Raw food, free inventory slot, empty lit dry campfire
  - "For crafting: 3 logs, 3 sticks and 1 coal or charcoal at a table"
depends_on:
  tools:
    - observe
    - smelt_item
    - craft_item
    - place_block
    - cook_campfire
    - navigate_to
    - deposit_items
    - say
  skills:
    - craft-tools-with-confirmed-inventory
    - return-to-base-open-door-and-deposit
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T20:40:21.476Z
  updated: 2026-10-12T20:40:21.476Z
version: 1
evidence:
  - episode: 2026-10-12-17-20-03
    outcome: success
    note: created from episode
    date: 2026-10-12T20:40:21.479Z
stats:
  successes: 1
  failures: 0
failure_modes:
  - "Occupied/unlit/waterlogged/unknown station: do not load."
  - "Unconfirmed load: do not click repeatedly."
  - "Missing cooked pickup: report partial; inspect station/drops before retrying."
tags:
  - campfire
  - cooking
  - food
  - delivery
---

## Procedure

Observe materials. Make charcoal from one extra log with planks as fuel if coal is unavailable. lib.craft_item campfire verifies actual server output; the runtime expands missing charcoal/wood combinations. Place outdoors on solid footing. Stand on solid footing beside the campfire, never on the fire. lib.cook_campfire accepts 1–4 raw foods of one type, validates empty server contents, confirms each consumption without repeated clicks and waits up to45seconds for actual cooked pickup. On partial/cancellation inspect remaining cooking food before loading again. Return through validated base entrance and open doors; deposit verified cooked counts into the saved base chest and announce what and where.

## Notes

One live success: spruce/charcoal campfire craft, safe placement, ONE CHICKEN cooked and collected in30seconds, then deposited. Fish cooking and four-slot batch have unit tests only. Do not claim fishing or fish delivery until observed.
