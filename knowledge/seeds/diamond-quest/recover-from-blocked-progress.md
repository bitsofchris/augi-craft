---
id: recover-from-blocked-progress
title: Recover from blocked progress
description: A checklist for when the same action keeps failing (path, crafting or tool errors).
kind: strategy
level: 1
when:
  - the same tool fails twice with the same error category
  - an action times out or the bot seems stuck
depends_on:
  tools: [stop_action, observe, navigate_to, kb_search]
  skills: []
prerequisites: []
implementation: "plan: follow the Procedure in a program using lib actions"
status: seed
source: { origin: "seed:diamond-quest", version: 1, author: augi-craft, inspired_by: "Voyager critic/retry loop (max 4 rounds)" }
version: 1
evidence: []
failure_modes:
  - Retrying identical arguments more than twice wastes the attempt budget.
tags: [recovery, retry, stuck, debugging]
---

## Procedure

1. `stop_action`, then `observe` — compare actual state to what you assumed.
2. Read the error category:
   - `unreachable`: pick a different target, or `lib.navigate_to` a nearby open position first.
   - `missing_materials`: read `observations.missing` and plan a subgoal to obtain them.
   - `missing_tool`: craft or equip the tool listed in `requiresOneOf`.
   - `no_station`: craft/place a crafting table or furnace.
   - `not_found`: explore 30-50 blocks away, then retry.
   - `timeout`/`partial`: retry with a smaller count.
3. Revise at most 4 times (Voyager's budget); then record a failure episode with what was learned and pick another subgoal.
