# Return to base, enter and unload

The reusable shared plan is `return-to-base-open-door-and-deposit`, validated from two live episodes on 2026-10-12. Run the steps as one program using the lib actions named below.

## Route

The route uses saved places, never fixed coordinates
([WORLD_STATE.md](WORLD_STATE.md)). Save them once per world with
`lib.save_location`:

| Place | Use |
| --- | --- |
| `base` | General landmark, not an entrance target |
| `base_entrance` | Clear approach square outside the door |
| `base_door` | The lower door block(s); open explicitly |
| `base_inside` | Verified interior standing position |
| `base_chest` | Assigned supply chest |
| `base_unload` | Alternate clear standing square beside storage |

1. Observe inventory and recall the current entrance/chest locations. Keep required equipment and travel supplies.
2. Navigate to `base_entrance` with `walkOnly: true`, `range: 0`.
3. Call `lib.set_door` with `open: true` on the door blocks. Verify actual open state; an already-open door is fine.
4. Navigate to `base_inside` with `walkOnly: true`, `range: 0`. Verify settled interior position.
5. Call `lib.deposit_items` for intended resources at the explicit assigned chest coordinates. Verify inventory removal and reported chest contents. The live test accessed this chest from the interior without moving. If access changes, use the verified unloading square.
6. Announce delivered quantities and chest coordinates, then wait inside when requested. Do not automatically close powered doors or trap players.

Use `lib.inspect_door` if the house changes: it reads door facing/state and a 5-by-5 neighborhood of floor, feet and head blocks without moving. Recheck all world-specific coordinates after rebuilding. Iron doors need their existing redstone control. Never excavate the house or climb onto storage as the normal route.

## Runtime repairs and evidence

The installed pathfinder had two separate problems: its movement planner considered open wooden doors physical blocks, and its path postprocessor aimed at the top of the thin panel: the captured doorway target was one block above the walking floor and off the block's center. Navigation repeatedly stalled or detoured onto chest tops.

`runtime/bot/door-navigation.js` admits straight movement along an open wooden doorway's facing axis, preserves explicit avoidance, and normalizes admitted door path nodes to the floor-level center. It handles both initial and resumed partial searches. Actual world collision shapes and player/server positions are not changed; closed/iron doors and movement across the open panel remain blocked in regression coverage.

`lib.deposit_items` and `lib.withdraw_items` now approach storage using walking-only navigation. Failure to reach a chest stops before opening it. Original movement settings are restored after navigation succeeds or fails.

Test coverage includes real native 26.3 door shapes and path neighbors, closed/iron doors, panel direction, clone/avoidance behavior, incorrect elevated postprocessed targets, read-only doorway inspection, and non-destructive chest approach/failure cleanup.

Runtime changes reach a running worker only after its MCP server restarts.
