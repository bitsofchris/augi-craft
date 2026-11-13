---
id: voyager-smelt-cactus-into-green-dye
title: smeltCactusIntoGreenDye
description: The function is about smelting 5 cactus into green dye using a furnace and coal as fuel. It checks if there is a furnace in the inventory, and if not, it crafts one. Then it finds a suitable position to place the furnace and places it there. Finally, it smelts the cactus using coal as fuel and saves the event of smelting 5 cactus into green dye.
kind: code-reference
level: 2
when:
  - The function is about smelting 5 cactus into green dye using a furnace and coal as fuel
prerequisites: []
depends_on:
  tools:
    - smelt_item
    - place_block
  skills:
    - voyager-craft-furnace
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/smeltCactusIntoGreenDye.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - smeltItem
  - placeItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - smeltitem
  - placeitem
---

## Summary

The function is about smelting 5 cactus into green dye using a furnace and coal as fuel. It checks if there is a furnace in the inventory, and if not, it crafts one. Then it finds a suitable position to place the furnace and places it there. Finally, it smelts the cactus using coal as fuel and saves the event of smelting 5 cactus into green dye.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (smelt_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function smeltCactusIntoGreenDye(bot) {
  // Check if there is a furnace in the inventory
  const furnaceItem = bot.inventory.findInventoryItem(mcData.itemsByName.furnace.id);

  // If not, craft a furnace using the available cobblestone
  if (!furnaceItem) {
    await craftFurnace(bot);
  }

  // Find a suitable position to place the furnace
  const furnacePosition = await findSuitablePosition(bot);
  if (!furnacePosition) {
    bot.chat("Could not find a suitable position to place the furnace.");
    return;
  }

  // Place the furnace at the suitable position
  await placeItem(bot, "furnace", furnacePosition);

  // Smelt 5 cactus using the available coal as fuel
  await smeltItem(bot, "cactus", "coal", 5);
  bot.chat("5 cactus smelted into green dye.");
}
```
