---
id: deliver-items-to-player
title: Deliver items to a player
description: "Player preference: giving items means dropping them in front of the recipient or depositing them in a nearby chest, followed by an in-game chat announcement."
kind: strategy
level: 2
when:
  - asked to give or deliver items to a player
prerequisites: []
depends_on:
  tools:
    - find_player
    - navigate_to
    - give_items
    - deposit_items
    - say
    - observe
  skills: []
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T15:47:28.261Z
  updated: 2026-10-12T15:47:28.261Z
version: 1
evidence: []
stats:
  successes: 0
  failures: 0
failure_modes: []
tags:
  - delivery
  - players
  - chest
  - chat
  - preferences
---

## Procedure

1. Identify the exact recipient username and requested item quantities. Use the designated base when provided.
2. Prefer a nearby chest when the recipient moves or the surface is slippery. Deposit the items and verify the inventory decrease and chest contents. Alternatively drop the items on the ground directly in front of the recipient. A verified pickup is useful but is not required by the player's delivery definition.
3. Send an in-game chat message naming the recipient, items and quantities, and the chest or drop coordinates. Never announce a chest deposit before it succeeds.
4. Report the delivery method honestly. If a tossed stack misses or slides away, recover it and deposit it in a nearby chest. Save the new base location when the player changes it.

## Notes

Explicit user preference supplied 2026-10-12: 'give to player' means drop in front of them or put in a nearby chest for them, then send chat saying what was done. Do not require the recipient to be standing still for a chest delivery.
