# Bodyguard skill and verification

This composes inventory/crafting, `lib.guard_player`, and `lib.shoot_bow`. Knowledge
entry: `player-bodyguard` in the starter pack (a candidate until live evidence
justifies promotion), with the helper `guardUntilStopped`.

## Prepare, then announce

Read the assignment and exact player username with `lib.find_player` (Bedrock names
include the leading dot). Inspect authorized base storage first. Take reasonable
available sword, armor, bow and ordinary arrows; leave essential shared supplies.
Announce genuine needs briefly with `say`: “Guard: checking our supply chest
for a sword and armor,” then “I need three string for a bow” only if unavailable.
Craft a stone/iron sword, bow, arrows and affordable armor from available
materials; equip armor with `lib.equip_item`. A bow is three sticks and three string;
arrows require a stick, flint and feather. Check recipes through `lib.craft_item`.
Do not claim readiness when bow/ammunition or other prerequisites are absent.
Sword-only guarding is possible while a missing bow remains a reported blocker.

## Follow and defend

Announce the chosen player and intent to follow about five blocks behind. Call
`lib.guard_player({username, distance:5, seconds:60, useBow:true})`. Repeat finite
intervals while the assignment remains active, checking chat/health/food between
them. Stop on the player's instruction, disconnect, inaccessible route or low
supplies. Stay behind the player's orientation and avoid their personal space;
do not dig, place, teleport or force a dangerous route to keep up.

Damage attribution (`entityHurt(victim, source)` in the installed Mineflayer)
identifies a hostile mob attacking the principal or the guard, and a principal
attacking a hostile mob. Those are the only combat triggers. Merely seeing a
nearby mob does not initiate combat. Unknown damage sources are not guessed.
The controller excludes players, pets, livestock and named entities, never
retaliates in PvP, and stops pursuing threats more than eight blocks from the
principal. Unreachable threats are abandoned after a bounded stall.

Use sword strikes with cooldown at close range. Bow shots use a gravity/drag
compensated static aim, full draw and ordinary arrows; no predictive moving-target
lead is implemented. The firing arc must be clear of blocks and friendlies;
bow use is withheld in close melee around the principal. Cancelled draws switch
away from the bow before releasing use, avoiding a shot on cancellation.

## Practice and evidence

Outside the house, choose an observed solid stone/dirt/cobblestone backstop
3–24 horizontal blocks away, with nobody or any pet along the arc. A disposable
block placed from inventory is fine. Call `lib.shoot_bow({x,y,z})` for up to three
shots, inspect arrows used and impact evidence, and save the outcome. Consuming
an arrow proves firing, not a hit. The tool reports impact separately; an absent
confirmation remains unverified. Do not use a player as a target or create mobs
with commands for testing.

Then test `lib.guard_player` on a visible stationary player (another bot is a
player entity), verifying a settled 4–6 block separation and
no attacks without a trigger. Offline humans cannot be followed. Testing on a
stationary bot is not proof of following a moving human or successful defense
against real hostile mobs; record those as pending until they occur.

## Evidence

Unit tests cover the guard loop and bow use. A stationary-bot test and one
live session are recorded on the `player-bodyguard` skill; following a moving
human under real attack is still to be shown.
