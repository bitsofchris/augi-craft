---
id: voyager-craft-lightning-rod
title: craftLightningRod
description: The function is about crafting a lightning rod. It first finds a suitable position to place the crafting table and places it there. Then it checks if there are enough copper ingots in the inventory, and if not, it mines copper ores and smelts them into copper ingots. Finally, it crafts a lightning rod using the crafting table.
kind: code-reference
level: 2
when:
  - The function is about crafting a lightning rod
prerequisites: []
depends_on:
  tools:
    - gather_blocks
    - craft_item
    - smelt_item
    - place_block
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/craftLightningRod.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - mineBlock
  - craftItem
  - smeltItem
  - placeItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - mineblock
  - craftitem
  - smeltitem
  - placeitem
---

## Summary

The function is about crafting a lightning rod. It first finds a suitable position to place the crafting table and places it there. Then it checks if there are enough copper ingots in the inventory, and if not, it mines copper ores and smelts them into copper ingots. Finally, it crafts a lightning rod using the crafting table.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, smelt_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function findSuitablePosition(bot) {
  const offsets = [new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1)];
  for (const offset of offsets) {
    const position = bot.entity.position.offset(offset.x, offset.y, offset.z);
    const block = bot.blockAt(position);
    if (block.name === "air") {
      return position;
    }
  }
  return null;
}

async function craftLightningRod(bot) {
  // Find a suitable position to place the crafting table
  const craftingTablePosition = await findSuitablePosition(bot);

  // Place the crafting table at the found position
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Check if there are enough copper ingots in the inventory
  const copperIngotsCount = bot.inventory.count(mcData.itemsByName.copper_ingot.id);

  // If not enough copper ingots, mine copper ores and smelt them into copper ingots
  if (copperIngotsCount < 3) {
    await mineBlock(bot, "copper_ore", 3 - copperIngotsCount);
    bot.chat("Collected copper ores.");
    await smeltItem(bot, "copper_ore", "coal", 3 - copperIngotsCount);
    bot.chat("Smelted copper ores into copper ingots.");
  }

  // Craft a lightning rod using the crafting table
  await craftItem(bot, "lightning_rod", 1);
  bot.chat("Crafted a lightning rod.");
}
```
