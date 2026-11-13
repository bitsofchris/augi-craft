---
id: voyager-craft-iron-shovel
title: craftIronShovel
description: The function crafts an iron shovel using a crafting table. It checks if there are enough iron ingots and sticks in the inventory, and if not, collects the required items. It finds a suitable position to place the crafting table and places it there. Then, it crafts an iron shovel using the crafting table.
kind: code-reference
level: 2
when:
  - The function crafts an iron shovel using a crafting table
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
  path: skill_library/trial1/skill/code/craftIronShovel.js
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

The function crafts an iron shovel using a crafting table. It checks if there are enough iron ingots and sticks in the inventory, and if not, collects the required items. It finds a suitable position to place the crafting table and places it there. Then, it crafts an iron shovel using the crafting table.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, smelt_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftIronShovel(bot) {
  // Check if there are enough iron ingots and sticks in the inventory
  const ironIngotsCount = bot.inventory.count(mcData.itemsByName.iron_ingot.id);
  const sticksCount = bot.inventory.count(mcData.itemsByName.stick.id);

  // If not enough iron ingots or sticks, collect the required items
  if (ironIngotsCount < 1) {
    await mineBlock(bot, "iron_ore", 1);
    bot.chat("Collected iron ore.");
    await smeltItem(bot, "iron_ore", "coal", 1);
    bot.chat("Smelted iron ore into iron ingot.");
  }
  if (sticksCount < 2) {
    await craftItem(bot, "stick", 1);
    bot.chat("Crafted sticks.");
  }

  // Find a suitable position to place the crafting table
  const suitablePosition = bot.entity.position.offset(1, 0, 0);
  const block = bot.blockAt(suitablePosition);
  if (block.name === "grass_block" || block.name === "dirt") {
    await bot.dig(block);
  }

  // Place the crafting table at the suitable position
  await placeItem(bot, "crafting_table", suitablePosition);

  // Craft an iron shovel using the crafting table
  await craftItem(bot, "iron_shovel", 1);
  bot.chat("Crafted an iron shovel.");
}
```
