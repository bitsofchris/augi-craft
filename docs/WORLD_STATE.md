# World state

**Name:** per-world state

**Description:** facts about one Minecraft world (saved places, player
sightings, base notes) live in `$AUGI_HOME/knowledge/worlds/<world>/`, apart from the
skills and lessons that work in any world.

**When to use:** whenever a bot plays a world other than the default one (a
test world, a second save, a copy), or when you save a place, chest, mine or
base. Pick the world with `AUGI_WORLD`; a new name starts with no saved places.

## How it works

```
$AUGI_HOME/knowledge/
  core/, seeds/, learned/      shared: protocol, skills, lessons, helpers
  worlds/
    default/
      world.json               notes: base, chests, protected radius, rules
      locations.json           saved places (recall_location / save_location)
      sightings.json           player sightings (ignored by Git)
    <other world>/             created on first save
```

- `createAugi` (`runtime/mcp/augi.js`) reads `AUGI_WORLD`, else the crew file's
  `world` (default `default`),
  and points the location and sighting stores at that folder. `kb_map`
  returns `world: { name, notes, savedPlaces }` so an agent knows where it is.
- Launchers pass it: `agents/crew/start-worker.sh` uses `AUGI_WORLD`
  (default: the crew file's `world`); a test world can use
  `AUGI_WORLD=test`, an empty world.
- Helpers find the base and chests through saved places (`base`,
  `base_chest`, `food_chest`), never fixed coordinates. With none saved they
  return `ok: false` and say what to save.

## Rules

- A coordinate, a chest, a mine or "where the farm is" is world state: save it
  with `lib.save_location` (or `world.json` for notes), not in a skill.
- A skill or lesson must hold in any world: "dig a 1x2 staircase, never
  straight down", not "the mine is at" followed by its coordinates.
- Old episodes may still mention coordinates; they are history, not
  instructions.
