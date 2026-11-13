---
id: eat-and-recover-before-combat
title: Eat confirmed cooked food and recover before combat
description: Use safe cooked food and verified hunger/health observations to recover before hunting, and carry food on future trips.
kind: plan
level: 2
when:
  - health is too low to hunt safely
  - preparing a spider or hostile mob trip
prerequisites:
  - Safe standing location and ordinary safe food, or materials and station to cook it
depends_on:
  tools:
    - observe
    - withdraw_items
    - smelt_item
    - cook_campfire
    - eat_food
    - equip_item
  skills:
    - return-to-base-open-door-and-deposit
    - cook-food-on-confirmed-campfire
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T21:01:39.280Z
  updated: 2026-10-12T21:01:39.280Z
version: 1
evidence:
  - episode: 2026-10-12-20-57-48
    outcome: success
    note: created from episode
    date: 2026-10-12T21:01:39.281Z
stats:
  successes: 1
  failures: 0
failure_modes:
  - "No food in inventory: obtain/cook normal supplies."
  - "No inventory and hunger confirmation: inspect before retrying."
  - Do not enter combat with critical health or assume eating has already healed.
tags:
  - survival
  - food
  - health
  - hunting
---

## Procedure

Observe health, hunger and food before leaving. Carry cooked food and a sword for combat. If injured, return by a known safe route and stop inside base. Obtain ordinary cooked food from assigned supplies, cooking raw stock when needed. lib.eat_food consumes exactly one safe food and requires both inventory-1 and increased hunger; it restores previous equipment. Full hunger is a no-op. Remain safe and observe actual health recovery; eating does not instantly heal. If hunger falls below18 while injured, eat again when food is available. Resume combat only when actual health has recovered sufficiently (prefer18 ormore; attack tools stopbelow12). Preserve a return route and report missing food rather than repeatedly consuming without confirmation.

## Notes

Live proof: chicken food15→20, pork17→20; subsequent health0.5→18.43. Injury cause was not confirmed. Candidate, no second independent recovery episode yet.
