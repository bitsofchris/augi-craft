---
id: craft-tools-with-confirmed-inventory
title: Craft tools and weapons with confirmed inventory
description: Prepare materials, craft bounded tool and sword batches, and verify real server inventory before continuing; includes native 26.3 synchronization recovery.
kind: plan
level: 2
when:
  - need to replace a pickaxe, axe, sword, shovel or hoe
  - crafting appears to succeed but no tool persists
  - preparing a repeatable survival equipment supply
prerequisites:
  - Use trusted craft_item runtime with native 26.3 server-confirmed backend when on 26.3
  - Observe sufficient materials and a reachable crafting table; reserve at least one free inventory slot per unstackable output
depends_on:
  tools:
    - observe
    - craft_item
    - smelt_item
    - equip_item
    - deposit_items
  skills:
    - craft-planks-and-sticks
    - build-crafting-station
    - recover-from-blocked-progress
implementation: "plan: follow the Procedure in a program using lib actions"
status: validated
source:
  origin: learned
  created: 2026-10-12T16:28:46.865Z
  updated: 2026-10-12T16:28:46.865Z
  promoted: 2026-10-12T16:28:54.200Z
version: 1
evidence:
  - episode: 2026-10-12-16-27-51
    outcome: success
    note: created from episode
    date: 2026-10-12T16:28:46.866Z
  - episode: 2026-10-12-16-27-53
    outcome: success
    note: Separate wooden equipment subgoal verified five different shapes after 16 successful prerequisite recipes; independent server inventory confirmation.
    date: 2026-10-12T16:28:49.939Z
  - episode: 2026-10-12-21-00-59
    outcome: success
    note: Two stone pickaxes server-confirmed and persisted; torch and stick prerequisites also verified.
    date: 2026-10-12T21:01:14.732Z
stats:
  successes: 3
  failures: 0
failure_modes:
  - A locally fabricated output or resolved bot.craft promise is insufficient evidence of a real tool
  - Unrelated player inventory packets can corrupt menu revisions without the native per-window fix
  - Earlier queued server corrections can satisfy a sync listener before the current click is confirmed; never repeat the consuming click
  - Insufficient materials can produce partial batches; retry only the remaining verified shortfall
  - Conservative backend requires a free inventory slot even when a stackable result could fit an existing stack
tags:
  - crafting
  - tools
  - weapons
  - pickaxe
  - axe
  - sword
  - shovel
  - hoe
  - "26.3"
  - inventory
  - server-confirmed
---

## Procedure

1. Observe inventory, free slots, tool durability, and nearby crafting table. Craft only the replacement equipment needed; keep the working pickaxe until its replacement is verified.
2. Compose craft-planks-and-sticks for prerequisites. Use exact species names such as spruce_planks. lib.craft_item count requests OUTPUT ITEMS: 32 planks consumes 8 logs; 32 sticks consumes 16 planks. Outputs round up to a whole recipe. Avoid wasting the planks needed for wooden tools.
3. Budget each tool: pickaxe or axe = 3 head materials + 2 sticks; sword = 2 head materials + 1 stick; shovel = 1 head material + 2 sticks; hoe = 2 head materials + 2 sticks. One complete five-item set uses 11 head materials + 9 sticks. Wooden heads use compatible planks; stone heads use a supported stone recipe variant (cobbled deepslate verified). Iron/gold require ingots, not raw ore; use lib.smelt_item and verify ingot gain first. Diamond recipes require actual diamonds. Netherite upgrades are smithing, outside this procedure.
4. Compose build-crafting-station if needed. Prefer the observed base table over placing another one. Stand within safe reach using existing access; do not break base walls for access.
5. Call lib.craft_item with exact item name (for example stone_pickaxe or wooden_sword), desired count, and preferTable true. Keep batches small enough for inventory capacity. Wait for the full result before another mutation. The runtime may produce a partial quantity when stock is insufficient.
6. Require changes.inventory[target] to match the intended new output, observations.crafted/completedCrafts to agree, and ingredient consumption to match the selected recipe. On native 26.3 require observations.backend server-confirmed. Observe again after the batch: counts must persist after the menu closes. A tool already in inventory does not count as newly crafted.
7. On any partial/error, inspect crafted, consumed, error and fresh inventory. Keep real outputs; do not retry the original whole batch blindly. Missing materials: acquire only the actual shortfall. No station: fix reach/table availability. Full inventory: deposit spare supplies first. Unconfirmed clicks or mismatched output: stop, close/reconcile via runtime cleanup, and revise the cause before a new bounded attempt. Repeated synchronization failure needs runtime investigation, not more material spending.
8. Equip only a verified replacement. Deposit spare completed tools into the requested nearby chest and announce what and where in chat. Record the actual result and evidence in an episode.

## Notes

Live evidence on 2026-10-12, Paper server, native 26.3: 29 clean recipe
executions on the final runtime (eight spruce-plank recipes, eight stick
recipes, eight stone tools/swords and five wooden tools/swords). All five
shapes passed; stone pickaxe, axe and sword passed count-2 batches. Server NBT
independently confirmed outputs after menus closed, and the test tools were
delivered to the saved base chest. Material scope proven live: spruce planks
and cobbled deepslate. Other plank/stone variants and iron/gold/diamond
crafting are supported by recipe selection but not live-validated here.
Container-return recipes, smithing, enchantments and full-inventory stacking
are outside the verified scope. The native backend confirms actual server
transactions, which plain `bot.craft` does not.
