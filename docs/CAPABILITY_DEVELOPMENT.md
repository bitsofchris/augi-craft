# Extending the lib action library

Workers play by writing programs (`run_program`), so most new behaviour needs
no runtime change: write the program, then `save_helper` it. Change the runtime
only when a program cannot do the job with `lib`, raw Mineflayer, and helpers,
for example a Mineflayer or 26.3 protocol bug, a missing plugin, or an action
that needs a regression test to stay reliable.

The operator authorizes every worker to make such changes for ordinary survival play
without asking each time. No cheats, operator commands, item spawning,
teleporting, PvP, or removing protections for the house, pets, storage or players.

## Helper or lib action?

| Use a helper (`save_helper`) | Change `runtime/tools` (a lib action) |
|---|---|
| Composes lib actions and Mineflayer calls | Works around a protocol or Mineflayer bug |
| Is a strategy (how to hunt, mine, build) | Needs deterministic tests to stay correct |
| Should improve from play | Is shared plumbing many helpers rely on |

Prefer helpers. A helper that every role depends on and keeps breaking is the
signal to move it into `runtime/tools` with tests.

## Procedure for a lib change

1. Announce it in chat and your pane; one worker owns a file at a time.
2. Add the handler in `runtime/tools`, register it in `runtime/tools/index.js`
   with a zod input, and use the run context: check `ctx.checkAbort()` in loops,
   clean up listeners and controls, and verify effects.
3. Add tests for success, missing prerequisites, invalid targets and
   cancellation. Run `npm test`; failing tests block live use.
4. Restart only your own MCP connection at a safe point. Running processes do
   not pick up runtime changes.
5. Make one bounded live attempt from a program, verify the real effect, and
   record an episode. Tell teammates to restart their connections.
