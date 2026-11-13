---
id: player-bodyguard
title: Equip and defend a player while following at a safe distance
description: Check base supplies, prepare and announce sword/armor/bow readiness, follow about five blocks behind a player, and react defensively to attributed hostile-mob combat.
kind: plan
level: 2
when:
  - player asks for a bodyguard or defensive companion
prerequisites:
  - exact online tracked player username
  - verified sword and sufficient health/food
  - optional verified bow and ordinary arrows; report missing materials
depends_on:
  tools:
    - kb_search
    - find_player
    - observe
    - find_blocks
    - inspect_container
    - withdraw_items
    - craft_item
    - smelt_item
    - equip_item
    - say
    - guard_player
    - shoot_bow
    - read_chat
  skills:
    - craft-tools-with-confirmed-inventory
    - craft-planks-and-sticks
    - recover-from-blocked-progress
implementation: "plan: follow the Procedure in a program using lib actions"
status: candidate
source:
  origin: learned
  created: 2026-10-12T18:55:57.974Z
  updated: 2026-10-12T18:55:57.974Z
version: 1
evidence:
  - episode: 2026-10-12-18-54-48
    outcome: success
    note: created from episode
    date: 2026-10-12T18:55:57.978Z
stats:
  successes: 1
  failures: 0
failure_modes:
  - Offline or untracked principal cannot be followed
  - Mob attacker attribution may be absent; never guess
  - Static bow aim does not lead moving targets
  - Arrow consumption alone does not confirm impact
  - Tool approval usage limits can block live tests
  - Follow geometry in narrow terrain may have no safe path
tags:
  - bodyguard
  - defense
  - follow
  - combat
  - bow
  - equipment
---

## Procedure

1. Verify your own character and the exact principal username using lib.find_player. Bedrock names keep their leading dot. If the principal is offline or out of tracking range, report that and do not invent a location.
2. Send a brief chat readiness message. At the base, find and inspect actual supply chests with lib.inspect_container. Use available sword, armor, bow and arrows before crafting replacements; keep essential shared stock and record exact withdrawals. Report missing ingredients accurately in chat.
3. Compose craft-tools-with-confirmed-inventory to craft a stone/iron sword and affordable armor when needed. Bow requires three sticks and three string; ordinary arrows require flint, stick and feather. Equip observed armor and sword. Verify persistent inventory output; never claim readiness from intended crafting. Sword-only guarding may proceed if bow remains an explicit limitation.
4. For bow practice outside base, choose an observed solid backstop 3–24 horizontal blocks away with a clear arc and no friendlies. Use lib.shoot_bow at its coordinates for up to three shots. Verify arrowsUsed and separately hitConfirmed; unconfirmed impact is not a successful hit. No players or pets as targets.
5. Announce that you will follow the named principal about five blocks behind and defend them. Call lib.guard_player with username, distance5, seconds60, useBow true. Repeat finite intervals only while assignment remains active, checking read_chat and health/food between them.
6. Controller uses nondestructive following and avoids personal space. It only engages allowed hostile mobs when entityHurt attributes an attack against the principal/guard or the principal attacks that mob. Seeing a nearby hostile does not start a fight; unknown sources and PvP do not trigger retaliation. No players, pets, livestock or named entities are combat targets.
7. Use sword with cooldown near a threat; use bow only when available, distant enough and the arc is clear of the principal and other friendlies. Do not chase beyond eight blocks from principal or through an unsafe/stalled route. Stop safely for disconnect/tracking loss, low health/food, player stop instruction or route failure.
8. Verify stationary 4–6 block spacing with observe/lib.find_player. A stationary bot is a possible test principal when humans are offline, but does not prove moving-human following or real hostile defense. Record actual observations and keep untested behavior pending.
9. Save episodes and outcomes through knowledge tools. Promote only after distinct verified live episodes, never from simulation alone.

## Notes

Implementation details and live-test checklist in docs/BODYGUARD.md. Local tests pass for movement, defensive/assist attribution, PvP exclusion, sword/bow switching, real-data gear recipes, friendly/blocked shot rejection and cancellation. Live gear acquisition, target practice, stationary following and combat remain blocked by automatic approval-review usage limit. This is a candidate, not a live-validated bodyguard.
