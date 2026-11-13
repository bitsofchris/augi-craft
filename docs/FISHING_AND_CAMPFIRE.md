# Fishing and campfire cooking

Call these lib actions from a program. Retrieve the current learned skill and observe actual inventory before each trip.

## Supplies

- Fishing rod: 3 sticks and 2 string at a crafting table. Never replace rod fishing with killing fish when assigned to fish.
- Campfire: 3 sticks, 3 logs and 1 coal or charcoal. `lib.craft_item` expands the incomplete charcoal/wood recipe combinations and still verifies the server output.
- A free inventory slot, safe bank, open water, and an empty lit campfire.

## Actions

`lib.fish_once({x,y,z,seconds?})` makes one cast toward an observed water block with air above. Stand 2–7 blocks away on safe footing, with clear sight. Default bite limit is 60 seconds. The result reports inventory catch and the number of cookable cod/salmon. Treasure, junk and non-cookable fish do not satisfy a cooked-fish order. Call again only after the prior result. Cancellation and timeout switch away from the rod to retract it. A reel without inventory pickup is partial, not a successful catch.

`lib.cook_campfire({x,y,z,item,count?})` handles 1–4 food of one type. Stand beside the campfire 0.8–2.2 blocks away for pickup; never on the fire. It requires server block-entity contents to confirm the station is empty, loads each item only once and waits for observed inventory consumption, then waits up to 45 seconds for cooked inventory pickup. It does not navigate, light fires or take other players' cooking food. A partial or cancelled batch can leave food cooking; inspect it and inventory before retrying.

For ten fish, repeat casts until actual newly acquired cod plus salmon reaches ten. Cook batches of up to four, separately by species. Return using the validated doorway skill, deposit exactly the verified cooked items into the assigned chest and announce the actual counts and chest coordinates in game.

## Station

Put the campfire on a solid foundation with one clear standing square beside it. Save it as `campfire` with `lib.save_location`: that place is the fire itself, not a spot to stand on.

## Evidence boundaries

Unit tests cover actual catch verification, missing rod/water, blocked/distant targets, cancellation, hung casts, no pickup, campfire batches, busy/unlit/unknown stations, missing food and unconfirmed clicks. Live outcomes and any remaining prerequisites are recorded via `kb_*`; unit tests alone do not validate a learned gameplay skill.
