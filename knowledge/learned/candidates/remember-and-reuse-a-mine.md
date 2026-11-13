---
id: remember-and-reuse-a-mine
title: Remember and reuse a mine
description: "Treat a mine as world state: save its entrance, staircase waypoints, bottom and working face with save_location, and walk the saved waypoints in short hops on every later trip instead of one long path or a new staircase."
kind: lesson
level: 2
when:
  - digging a mine
  - going back down or up an existing mine
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "plan: follow the Procedure section in a program"
status: candidate
source:
  origin: learned
  created: 2026-10-18T12:45:08.942Z
  updated: 2026-10-18T12:45:08.942Z
version: 1
evidence:
  - episode: 2026-10-18-12-45-08
    outcome: success
    note: created from episode
    date: 2026-10-18T12:45:08.943Z
stats:
  successes: 1
  failures: 0
failure_modes: []
tags:
  - mining
  - navigation
  - world-state
---

## Procedure

1. When starting a mine, save the entrance with lib.save_location (note the stair direction).
2. While digging the staircase, push a waypoint every few stairs and save the list (one location whose note holds the JSON list).
3. Save the bottom and the current working face.
4. On later trips: recall the waypoints and lib.navigate_to each one in turn (short hops plan reliably); continue at the face.
5. Going up: walk the waypoints in reverse, then to the entrance.
6. Light the stairs with torches so mobs do not spawn on them.
