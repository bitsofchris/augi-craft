# dig_tunnel

**Name:** `lib.dig_tunnel`

**Description:** dig a 1x2 passage one step at a time and walk into it: a level
tunnel, a staircase down, or a staircase up. It stops before anything unsafe
and reports every ore block it uncovers. It is plumbing, not a strategy: the
agent decides where to dig, in which direction, how deep and why.

**When to use:** any program that needs to get underground or move through rock:
going down to where an ore forms, branch tunnels, reaching a cave, climbing
out. Before this existed every agent wrote its own digging loop, and one
failed on a fractional coordinate.

## How it works

```js
const r = await lib.dig_tunnel({ direction: 'east', length: 12, slope: 'down', stopAtOre: true })
// r.ok: full length dug (or stopped at ore); r.observations:
// { steps, direction, slope, from, position, oresSeen: [{ name, x, y, z }], stoppedBecause }
```

Each step clears the cells the bot needs (2 for level, 3 for a stair) and
walks into the new spot. It stops, without digging the block, when:

- lava is next to the block, or water is in it or right above it;
- the next floor is missing and the bot carries nothing to patch it with
  (cobblestone, cobbled deepslate, dirt and other plain stone; never sand or
  gravel);
- the block is bedrock, a chest, barrel, furnace, crafting table, spawner or
  obsidian;
- the block needs a better tool than the bot has (`missing_tool`);
- with `stopAtOre: true`, as soon as new ore comes into sight.

It reports ore and does not mine it: the program decides what to take (for
example with `lib.gather_blocks`). A stop after some steps returns
`ok: false` with category `partial` and how far it got; a stop before the
first step returns the reason's own category.

Code: `runtime/tools/tunnel.js`. Tests: `test/tunnel.test.js`.

## Limits

- Strictly one direction per call; turn by calling it again.
- Does not place torches or fight; the self-defense reflex still runs.
- Walking into each step uses the pathfinder with a 10 s bound per step.
