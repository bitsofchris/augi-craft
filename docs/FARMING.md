# Wheat farming

**Name:** `lib.farm_wheat`

**Description:** One bounded pass over a small wheat field: harvest ripe wheat,
gather seeds from grass when none are carried, till soil with a hoe and plant.
Wheat regrows, so repeated passes are a food source that does not run out when
nearby animals are hunted out. 3 wheat crafts 1 bread (`lib.obtain_item`).

**When to use:** keeping the base food chest stocked (hunter role), or whenever
hunting finds no animals. Plant early in a session; harvest on later passes.

## How it works

`runtime/tools/farm.js`, `lib.farm_wheat({ x, y, z, radius = 4, plots = 16, seconds = 150 })`.
The center defaults to the block under the bot.

1. Harvest wheat at age 7 within `radius` (unripe crops are left), standing on
   the plot if drops did not reach the inventory.
2. With no seeds, break the nearest grass within 32 blocks (seeds drop one time
   in eight, up to 48 grass blocks).
3. Till dirt or grass blocks until the field has `plots` crops, preferring
   blocks within 4 blocks of water (moist farmland grows faster). Crafts a
   wooden hoe through `obtain_item` when none is carried. Then plant seeds on
   every empty farmland.

Each till, plant and harvest is verified by the block state or the inventory.
The result reports `harvested`, `tilled`, `planted`, `crops`, `ripe`, `wheat`,
`seeds` and `breadReady`; errors on single plots are listed, not fatal.

Wheat takes roughly 20–40 minutes of loaded, lit time to ripen. Snow does not
cover crops, so the field works in snowy biomes.

Related: `obtain_item` now gets string by breaking cobwebs with a sword, which
unblocks a fishing rod for `lib.fish_once` (see
[FISHING_AND_CAMPFIRE.md](FISHING_AND_CAMPFIRE.md)).

## Limits

- No fences: animals can trample farmland. Keep the field next to the base.
- No bone meal and no water placement (needs a bucket).
