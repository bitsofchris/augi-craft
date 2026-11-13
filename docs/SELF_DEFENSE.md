# Shared Minecraft self-defense

Creepers are never fought in melee: the reflex moves out of the fuse radius of
any creeper within 4.5 blocks. At night, a bot that respawns, or idles outdoors
with a hostile in sight, digs three blocks down and seals the hole
(`runtime/tools/shelter.js`, policy `nightShelter`, on unless set to false).
It never shelters a bot whose job is waiting to resume, and never while any
person is on the server: then bots keep working through the night. Crew bots
are the names in `$AUGI_HOME/crew.json` plus any `Augi*` name
(`runtime/bot/crew.js`); programs see the people online with `humans()`. Guards run with `AUGI_NIGHT_SHELTER=false`
(set by `agents/crew/start-worker.sh` for guard and bodyguard) and stay with
their player all night. Background programs the reflex interrupts resume after
the fight, and after a death once the bot respawns.

Policy: defend locally. Automatic defense never returns to
base, follows a refuge route, or opens/closes base doors. Explicit assignments
such as delivering cooked fish to the chest can still return to base.

`selfDefense` in `augi.config.json` enables the reflex for the MCP bots using that config. Existing
processes require reload. It runs the self_defense handler (also callable as
lib.self_defense) through BotSession.run, with one action owning movement at a
time. When it fires during a program it stops that program and reports the
fight in the next result's `inbox`. A program started with
`defense: "program"` suppresses the reflex and must handle combat itself. Every half-second,
walkOnly lib.navigate_to owns opportunistic sword attacks within reach while
keeping its destination and movement active. Its travel defense suppresses a
separate reflex controller; it does not chase or change goals. Outside that
travel action, idle work interrupts for visible hostiles within 3.5 blocks.
Digging or gathering ore interrupts for visible hostiles within ten blocks. Damage
and falling health also trigger reassessment. The interrupted handler and its
finally cleanup must settle before defense begins.

Defense equips the best available sword or uses an empty hand. It attacks
identified mobs with visible line of sight and a one-second swing interval,
retargets nearby threats, and attempts to collect local defeated mob drops.
The dynamic pursuit goal is set once per target, following into one-block
range; it is not reset each tick. Server damage events and actual deaths are
reported separately from swings. Death is latched even after immediate respawn.
Each attempt is bounded to thirty seconds and eight blocks from its starting
position, with no digging, scaffolding, parkour or drops larger than three blocks. Creepers receive
short local spacing after a swing. Low health or hunger never selects a base
route. These bounds cannot guarantee survival, especially against explosives,
ranged attackers or several mobs.

Players, pets, named mobs and passive animals are never attacked. Neutral mobs
are targeted only when positively identified as the attacker. Unknown damage
without an identified visible threat produces no guessed attack or base travel.

bot_status.selfDefense exposes pending/active/paused state and lastResult.
Hostile mobs and failed defense never impose a work-command gate. Every
explicit exclusive work command clears the old pause and cancels queued
defense. If defense is active, it cooperatively stops and waits up to five
seconds for actual cleanup before handing over control. A genuinely stuck
handler can still report busy because two actions must not share movement.
lib.resume_work succeeds with nearby mobs and cancels queued defense too.
The agent continues the assignment instead of refusing because of danger.
Retry cooldown is five seconds after success and fifteen after failure.
stop_action cancels defense normally. A stuck third-party handler retains its
lock until actual cleanup; defense never races its pathfinder.

Validation: twenty focused deterministic tests cover local kills and pickup,
low health/unarmed defense, player/pet/visibility exclusion, unknown damage,
local bounds and stalled pursuit, creeper spacing, cancellation, action cleanup,
idle/damage triggers, timeout ownership, resume and manual stop. Live combat validation must be recorded separately;
unit tests alone prove neither a live kill nor guaranteed survival.

Live follow-up after continuous pursuit: a crowded spawn encounter still
ended in death (reported died=true, zero swings). Travel-with-attacks integration
was added afterward; validate it separately before claiming effective escape.
