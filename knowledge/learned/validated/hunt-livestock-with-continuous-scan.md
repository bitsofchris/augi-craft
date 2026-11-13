---
id: hunt-livestock-with-continuous-scan
title: Hunt livestock with continuous scanning and verified pickup
description: Patrol for ordinary livestock, pursue and repeatedly attack with cooldown, confirm death, and collect real inventory drops inside one bounded action.
kind: plan
level: 2
when:
  - asked to hunt any animal for food
  - need livestock drops and have a sword
  - hunting worker stalls between observation, movement and individual attacks
prerequisites:
  - Sword in inventory; at least two free slots; health at least12 and food at least6
  - Use a reloaded runtime exposing hunt_animals with default animal any and pickup verification
depends_on:
  tools:
    - observe
    - hunt_animals
    - attack_animal
    - navigate_to
    - deposit_items
    - say
  skills:
    - craft-tools-with-confirmed-inventory
    - recover-from-blocked-progress
    - deliver-items-to-player
implementation: "plan: follow the Procedure in a program using lib actions"
status: validated
source:
  origin: learned
  created: 2026-10-12T16:44:56.571Z
  updated: 2026-10-12T16:44:56.571Z
  promoted: 2026-10-12T16:45:23.611Z
version: 1
evidence:
  - episode: 2026-10-12-16-43-44
    outcome: success
    note: created from episode
    date: 2026-10-12T16:44:56.573Z
  - episode: 2026-10-12-16-44-07
    outcome: success
    note: Independent second patrol verified another real chicken death and full pickup, then continued scanning.
    date: 2026-10-12T16:45:20.552Z
stats:
  successes: 2
  failures: 0
failure_modes:
  - Old runtime or sheep-only default silently misses other livestock
  - No animals encountered is a search/location result; improve coverage or change area
  - Server death may precede loot metadata and falling-item position updates
  - A confirmed kill without positive collected inventory stays partial; do not report complete pickup
  - A target that disappears without a death event is not confirmed killed
tags:
  - hunting
  - animals
  - livestock
  - food
  - scan
  - combat
  - pickup
  - drops
  - any
  - chicken
---

## Procedure

1. Verify your own bot identity and observe health, food, sword, inventory capacity and current area. Compose the crafting skill if no sword is available. Preserve player pets and named animals.
2. For any-animal hunting call lib.hunt_animals with animal any (also the default), radius32 to48, maxKills1 to3, and seconds30 to60. This searches ordinary livestock: sheep, cow, pig, chicken and rabbit. An explicit species is only for a species-specific resource assignment; use sheep for wool. Do not silently substitute a sheep-only or pig-only patrol for any-animal hunting.
3. Let the single action scan each movement tick, switch from patrol to a selected target, follow safely, check reach and line of sight, attack at a 20-tick cooldown, confirm an entity death event, and pursue newly spawned loot. Do not interleave long navigate/observe calls or ask the assistant to decide every hit. For an already observed particular livestock target, lib.attack_animal composes the same pursuit/combat/pickup engine.
4. Verify each encounter: killVerified true, collectionVerified true, remainingDrops zero, and positive collected inventory. Compare outer changes.inventory and a fresh observe. Attack count, target disappearance, elapsed time, or a local swing is not proof of a kill or pickup.
5. Empty encounters with zero kills/delta mean no eligible livestock was encountered, not a demonstrated combat failure. Move to a fresh safe surface area using lib.navigate_to with walkOnly true, then try a finite patrol there. Reached waypoints advance immediately. Do not repeat empty patrols at the same center indefinitely.
6. On kill with partial/unconfirmed pickup, stop patrol and inspect before leaving the loot. Missing sword, inventory capacity, low health/food, identity change, bounded pursuit stall, or inaccessible path require resolving that specific blocker. Do not count uncollected drops as obtained. Do not infer death from unloading or target disappearance.
7. Return to the assigned delivery chest with walkOnly travel; deposit only collected resources and announce contents and chest coordinates when delivering to the player. Record the verified delta and encounter evidence in an episode.

## Notes

Final runtime tests on 2026-10-12: 97 tests pass. Live on native 26.3, two
independent patrols in open grassland: three chicken deaths, 12 attacks and 12
server damage events; chicken +3, feather +4; all three had collectionVerified
true and remainingDrops 0. The first successful two-kill call took about 11.5
seconds. A prior 60-second patrol in a hunted-out area met no livestock in
1174 scans, which is what motivated changing area instead of waiting. Unit
tests cover mixed livestock/default any, species filtering, pets/players,
repeated attacks, delayed/falling cooked drops, failed pickup, cancellation,
capacity, missing sword, invalid bounds and pursuit stalls. Live scope is
chickens; other livestock and cooked drops are covered by deterministic tests
only. This is a bounded scripted action, not a persistent background
assignment. Land hunting excludes fish, pets, named animals and hostile mobs;
`lib.attack_mob` is separate.
