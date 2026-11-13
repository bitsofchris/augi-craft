// The action library behind `lib` in programs (see runtime/program/lib.js).
// Each entry declares a zod input shape and a handler that runs with a
// BotSession.run context.
import { z } from 'zod'
import { eatFood } from './food.js'
import { scanMobs } from './mobs.js'
import { fishOnce } from './fishing.js'
import { cookCampfire } from './campfire.js'
import { observe } from './observe.js'
import { findBlocksTool, navigateTo, inspectNavigation, stepTo } from './navigate.js'
import { gatherBlocks, digBlockAt } from './gather.js'
import { craftItem } from './craft.js'
import { smeltItem } from './smelt.js'
import { equipItem, depositItems, withdrawItems, inspectContainer } from './inventory.js'
import { placeBlock } from './place.js'
import { setDoor, inspectDoor } from './doors.js'
import { shearSheep } from './animals.js'
import { huntAnimal, attackMob } from './hunt.js'
import { huntArea } from './hunt-area.js'
import { saveLocation, recallLocation } from './locations.js'
import { findPlayer, giveItems, goToPlayer } from './players.js'
import { ErrorCategory, fail, ok } from './result.js'
import { shootBow } from './bow.js'
import { selfDefense, resumeWork } from './self-defense.js'
import { guardPlayer } from './bodyguard.js'
import { obtainItem } from './obtain.js'
import { shelter } from './shelter.js'
import { digTunnel } from './tunnel.js'
import { farmWheat } from './farm.js'

// Block coordinates: programs often pass entity positions (432.5), so floor them
// to the block instead of rejecting the call.
const coord = z.number().finite().transform(Math.floor)
const optionalCoords = { x: coord.optional(), y: coord.optional(), z: coord.optional() }

export const gameTools = [
  {
    name: 'obtain_item',
    description: 'Get `count` of an item by planning backwards: gather raw blocks, smelt, or craft, obtaining ingredients, pickaxes, a crafting table and a furnace as needed. Accepts loose names ("planks", "wood", "torches"). Any wood species works; with no tree in range it walks to the nearest loaded tree or searches outward in a spiral for up to about 150 s. Returns steps taken. Ores must be visible (go underground first); food from animals needs hunting.',
    input: { item: z.string(), count: z.number().int().min(1).max(256).optional(), maxDistance: z.number().int().min(8).max(128).optional() },
    timeoutMs: 300_000,
    handler: obtainItem
  },
  {
    name: 'resume_work',
    description: 'Resume work as requested, including with nearby hostile mobs. Cancels pending automatic defense; no hostile-mob safety pause or movement.',
    input: {},
    timeoutMs: 5_000,
    handler: resumeWork
  },
  {
    name: 'self_defense',
    description: 'Defend locally against identified nearby hostile mobs, including when injured or unarmed. Never return to base or operate doors. Bounded to30seconds and8blocks; sword cooldown, safe local creeper spacing, no PvP, pets, named mobs or terrain edits. Invoked automatically by session reflex.',
    input: {},
    timeoutMs: 120_000,
    handler: selfDefense
  },
  {
    name: 'eat_food',
    description: 'Eat one ordinary safe inventory food in place. Confirms consumption and increased hunger, cancels item use on interruption, restores equipment. Does not claim instant health regeneration.',
    input: { item: z.string() },
    timeoutMs: 10_000,
    handler: eatFood
  },
  {
    name: 'scan_mobs',
    description: 'Read tracked nearby unnamed spiders/cave spiders or hostile mobs, their entity IDs and positions, and live server difficulty/time. No movement, attacks, world edits or hidden block searches.',
    input: { mob: z.enum(['spider', 'hostile']).optional(), radius: z.number().int().min(1).max(64).optional() },
    exclusive: false,
    timeoutMs: 5_000,
    handler: scanMobs
  },
  {
    name: 'inspect_container',
    description: 'Inspect chest/barrel contents without withdrawing anything. Use exact coordinates for authorized base supply storage; approaches without digging or placing.',
    input: { ...optionalCoords },
    timeoutMs: 60_000,
    handler: inspectContainer
  },
  {
    name: 'guard_player',
    description: 'Follow an exact visible player about 5 blocks behind, without terrain edits. Defend only against attributed hostile-mob attacks or assist that player attacking a hostile mob. Never PvP or initiate fights. Sword required; bow optional when equipped and a friendly-free arc exists. Bounded, cancellable, stops for lost player, stalled path or low health/food.',
    input: { username: z.string().min(1), seconds: z.number().int().min(1).max(120).optional(), distance: z.number().min(4).max(8).optional(), useBow: z.boolean().optional() },
    timeoutMs: 130_000,
    handler: guardPlayer
  },
  {
    name: 'shoot_bow',
    description: 'Fire one fully drawn ordinary arrow at an observed hostile mob by entityId, or a solid practice backstop at x/y/z. Compensates gravity for a static target, checks the arc for obstructions and friendlies, and separately reports arrow use and confirmed impact. Requires bow and ordinary arrows, target 3–24 horizontal blocks away. No players or pets.',
    input: { entityId: z.number().int().min(0).optional(), x: coord.optional(), y: coord.optional(), z: coord.optional() },
    timeoutMs: 10_000,
    handler: shootBow
  },
  {
    name: 'fish_once',
    description: 'Cast a fishing rod toward a visible open water block from a safe bank, wait for a bite, reel and verify inventory pickup. One bounded cast. Returns actual catch and cookable fish count; retracts on cancellation.',
    input: { x: coord, y: coord, z: coord, seconds: z.number().int().min(1).max(75).optional() },
    timeoutMs: 85_000,
    handler: fishOnce
  },
  {
    name: 'farm_wheat',
    description: 'One pass over a wheat field around x/y/z (default: the block under the bot): harvest ripe wheat, break grass for seeds when none are carried, till soil (water-side first) with a hoe (crafts a wooden hoe if needed) and plant seeds, up to `plots` crops. Wheat regrows; repeat passes every ~20 minutes. 3 wheat crafts 1 bread.',
    input: { ...optionalCoords, radius: z.number().int().min(1).max(8).optional(), plots: z.number().int().min(1).max(64).optional(), seconds: z.number().int().min(10).max(280).optional() },
    timeoutMs: 290_000,
    handler: farmWheat
  },
  {
    name: 'cook_campfire',
    description: 'Load 1–4 raw food into an empty observed lit campfire within 2.2 blocks, wait for cooking and verify cooked inventory pickup. Stay safely beside the fire; no movement or fuel needed. Inspect partial batches before retrying.',
    input: { x: coord, y: coord, z: coord, item: z.enum(['cod', 'salmon', 'chicken', 'beef', 'porkchop', 'mutton', 'rabbit', 'potato']), count: z.number().int().min(1).max(4).optional() },
    timeoutMs: 60_000,
    handler: cookCampfire
  },
  {
    name: 'inspect_door',
    description: 'Read an observed nearby door state, facing, and adjacent floor/feet/head blocks before choosing safe doorway approach and interior waypoints. Does not move or edit blocks.',
    input: { x: coord, y: coord, z: coord },
    exclusive: false,
    timeoutMs: 5_000,
    handler: inspectDoor
  },
  {
    name: 'hunt_animals',
    description: 'Continuously patrol and scan for any eligible livestock (default animal=any), or a selected species. Interrupt movement to pursue, attack with cooldown until confirmed death, and collect drops. Bounded trip; then inspect/deliver. No players, pets, named animals or terrain edits.',
    input: { animal: z.enum(['any', 'sheep', 'cow', 'pig', 'chicken', 'rabbit']).optional(), radius: z.number().int().min(8).max(64).optional(), maxKills: z.number().int().min(1).max(8).optional(), seconds: z.number().int().min(5).max(90).optional() },
    timeoutMs: 100_000,
    handler: huntArea
  },
  {
    name: 'attack_mob',
    description: 'Pursue one observed hostile mob (zombie, skeleton, spider and common variants, slime, witch or pillager), attack with cooldown until death or bounded limit, and collect drops. No players, pets, named mobs, bosses or terrain changes. Stops for low health/food.',
    input: { entityId: z.number().int().min(0), maxHits: z.number().int().min(1).max(20).optional() },
    timeoutMs: 60_000,
    handler: attackMob
  },
  {
    name: 'shear_sheep',
    description: 'Shear one observed sheep by entityId within 3 blocks and clear line of sight. Requires shears. Verifies wool inventory gain or observed sheared state; drops may still need pickup. No chasing or terrain changes.',
    input: { entityId: z.number().int().min(0) },
    timeoutMs: 5_000,
    handler: shearSheep
  },
  {
    name: 'attack_animal',
    description: 'Follow one observed unnamed livestock animal within 32 blocks without terrain edits, attack with cooldown until confirmed death or bounded limit, and collect nearby drops. Requires a sword. No players or pets. Inventory gains and death confirmation are reported separately.',
    input: { entityId: z.number().int().min(0), maxHits: z.number().int().min(1).max(20).optional() },
    timeoutMs: 60_000,
    handler: huntAnimal
  },
  {
    name: 'set_door',
    description: 'Open or close a visible non-iron door within reach without moving, digging, or placing. Defaults to open; verifies the observed state and leaves already-correct doors unchanged.',
    input: { x: coord, y: coord, z: coord, open: z.boolean().optional() },
    timeoutMs: 5_000,
    handler: setDoor
  },
  {
    name: 'step_to',
    description: 'Walk or jump to one adjacent safe step, at most one block higher or lower. Bounded to 25 ticks and clears controls afterward.',
    input: { x: coord, y: coord, z: coord },
    timeoutMs: 10_000,
    handler: stepTo
  },
  {
    name: 'inspect_navigation',
    description: 'Diagnose a planned path and simulated first jump without moving.',
    input: { x: coord, y: coord, z: coord },
    timeoutMs: 10_000,
    handler: inspectNavigation
  },
  {
    name: 'dig_block',
    description: 'Dig one specific visible block within reach, using a suitable tool. Useful for clearing stair headroom; never digs through hidden blocks.',
    input: { x: coord, y: coord, z: coord },
    timeoutMs: 30_000,
    handler: digBlockAt
  },
  {
    name: 'find_player',
    description: 'Find an exact online username, including a leading dot for Bedrock players. Returns position when the player is within entity tracking range.',
    input: { username: z.string() },
    exclusive: false,
    timeoutMs: 5_000,
    handler: findPlayer
  },
  {
    name: 'dig_tunnel',
    description: 'Dig a 1x2 passage and walk into it, one step at a time: slope "level" (a tunnel), "down" or "up" (a staircase). Stops before lava, water, open drops it cannot patch, bedrock and storage, and when a block needs a better tool. Patches holes in the floor with cobblestone or dirt it carries. observations.oresSeen lists every ore block the tunnel uncovered (it does not mine them; stopAtOre stops at the first one). You decide where, which way and how far.',
    input: {
      direction: z.enum(['north', 'south', 'east', 'west']),
      length: z.number().int().min(1).max(64),
      slope: z.enum(['level', 'down', 'up']).optional().describe('Default level'),
      stopAtOre: z.boolean().optional().describe('Stop as soon as new ore is in sight (default false)')
    },
    timeoutMs: 280_000,
    handler: digTunnel
  },
  {
    name: 'shelter',
    description: 'Survive the night: dig 3 blocks down where the bot stands and seal the hole above its head. The bot stays there; leave after dawn by navigating out. The night reflex does this automatically after a respawn at night.',
    input: { depth: z.number().int().min(2).max(4).optional() },
    timeoutMs: 30_000,
    handler: shelter
  },
  {
    name: 'go_to_player',
    description: 'Walk to a player ("come here"): follow while visible, otherwise search around their newest sighting by any worker (or spawn). A failed search says whether every nearby spot was covered (observations.exhausted); call again to keep searching. Never ask players for coordinates.',
    input: { username: z.string(), range: z.number().min(1).max(8).optional(), seconds: z.number().int().min(5).max(280).optional() },
    timeoutMs: 290_000,
    handler: goToPlayer
  },
  {
    name: 'give_items',
    description: 'Approach a visible player by exact username and toss real inventory items toward them. Verifies pickup by that specific player; omit count for all.',
    input: { username: z.string(), item: z.string(), count: z.number().int().min(1).optional() },
    timeoutMs: 60_000,
    handler: giveItems
  },
  {
    name: 'observe',
    description: 'Observe position, health, food, inventory, equipment, nearby block counts, nearest notable resources/stations, entities and saved locations.',
    input: { radius: z.number().int().min(1).max(16).optional().describe('Cube radius for block counts (default 8)') },
    exclusive: false,
    timeoutMs: 15_000,
    handler: observe
  },
  {
    name: 'find_blocks',
    description: 'Locate nearby blocks without moving. Ore results must be in line of sight; buried ore is not revealed. Accepts aliases like "log", "iron", "coal".',
    input: { block: z.string(), maxDistance: z.number().int().min(1).max(128).optional(), count: z.number().int().min(1).max(32).optional() },
    exclusive: false,
    timeoutMs: 15_000,
    handler: findBlocksTool
  },
  {
    name: 'navigate_to',
    description: 'Navigate to coordinates, a block, or a saved location. Use walkOnly=true for travel without digging or placing terrain. Bounded by timeout.',
    input: {
      ...optionalCoords,
      block: z.string().optional(),
      location: z.string().optional(),
      walkOnly: z.boolean().optional().describe('Do not dig or place blocks during travel'),
      range: z.number().min(0).max(16).optional().describe('Stop within this many blocks (default 2)'),
      maxDistance: z.number().int().optional()
    },
    timeoutMs: 90_000,
    handler: navigateTo
  },
  {
    name: 'gather_blocks',
    description: 'Mine and pick up a number of blocks of a type (e.g. "log", "oak_log", "cobblestone", "iron"). Success is measured by inventory change.',
    input: { block: z.string(), count: z.number().int().min(1).max(64), maxDistance: z.number().int().min(1).max(128).optional() },
    timeoutMs: 180_000,
    handler: gatherBlocks
  },
  {
    name: 'craft_item',
    description: 'Craft `count` of an item from inventory. Uses a nearby crafting table or places one from inventory. Set preferTable for 2x2 recipes when inventory crafting is unreliable. Reports missing ingredients instead of auto-gathering.',
    input: { item: z.string(), count: z.number().int().min(1).max(64).optional(), preferTable: z.boolean().optional() },
    timeoutMs: 60_000,
    handler: craftItem
  },
  {
    name: 'smelt_item',
    description: 'Smelt items in a nearby furnace (or place one from inventory). Use raw items, e.g. raw_iron. Fuel is chosen automatically unless given.',
    input: { item: z.string(), count: z.number().int().min(1).max(64).optional(), fuel: z.string().optional() },
    timeoutMs: 300_000,
    handler: smeltItem
  },
  {
    name: 'equip_item',
    description: 'Equip an item (to hand by default, armor to its slot), or the best tool for a block type via forBlock.',
    input: { item: z.string().optional(), destination: z.enum(['hand', 'off-hand', 'head', 'torso', 'legs', 'feet']).optional(), forBlock: z.string().optional() },
    timeoutMs: 10_000,
    handler: equipItem
  },
  {
    name: 'place_block',
    description: 'Place a block from inventory at x/y/z, or at the nearest free spot next to the bot when coordinates are omitted.',
    input: { item: z.string(), ...optionalCoords },
    timeoutMs: 30_000,
    handler: placeBlock
  },
  {
    name: 'deposit_items',
    description: 'Put items into the nearest chest/barrel (or the one at x/y/z). Omit count to deposit all.',
    input: { item: z.string(), count: z.number().int().min(1).optional(), ...optionalCoords },
    timeoutMs: 60_000,
    handler: depositItems
  },
  {
    name: 'withdraw_items',
    description: 'Take items from the nearest chest/barrel (or the one at x/y/z). Omit count to take all.',
    input: { item: z.string(), count: z.number().int().min(1).optional(), ...optionalCoords },
    timeoutMs: 60_000,
    handler: withdrawItems
  },
  {
    name: 'save_location',
    description: 'Remember the current position (or x/y/z) under a name, e.g. "base", "iron_cave". Persisted in the knowledge base.',
    input: { name: z.string(), note: z.string().optional(), ...optionalCoords },
    exclusive: false,
    timeoutMs: 5_000,
    handler: saveLocation
  },
  {
    name: 'recall_location',
    description: 'Look up a saved location by name (e.g. "base", "farm", "food_chest"), or list all saved locations when name is omitted.',
    input: { name: z.string().optional() },
    exclusive: false,
    timeoutMs: 5_000,
    handler: async (ctx, args) => ctx.locations ? recallLocation(ctx.locations, args) : fail(ErrorCategory.GAME_ERROR, 'No location store configured')
  },
  {
    name: 'say',
    description: 'Send a chat message in game (e.g. to report progress to the player).',
    input: { message: z.string().max(256) },
    exclusive: false,
    timeoutMs: 5_000,
    handler: async (ctx, { message }) => {
      // Never let chat become a command channel (bots may have operator rights).
      if (message.trim().startsWith('/')) return fail(ErrorCategory.INVALID_ARGUMENT, 'Chat commands are not allowed')
      ctx.bot.chat(message)
      return ok('Sent chat message')
    }
  }
]
