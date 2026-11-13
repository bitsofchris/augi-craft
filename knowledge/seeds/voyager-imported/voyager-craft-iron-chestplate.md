---
id: voyager-craft-iron-chestplate
title: craftIronChestplate
description: The function crafts an iron chestplate using a crafting table. It first checks if there are enough iron ingots in the inventory, and if not, it mines iron ores and smelts them into iron ingots. Then it places a crafting table near the bot and crafts an iron chestplate using the crafting table.
kind: code-reference
level: 2
when:
  - The function crafts an iron chestplate using a crafting table
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
  path: skill_library/trial1/skill/code/craftIronChestplate.js
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

The function crafts an iron chestplate using a crafting table. It first checks if there are enough iron ingots in the inventory, and if not, it mines iron ores and smelts them into iron ingots. Then it places a crafting table near the bot and crafts an iron chestplate using the crafting table.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, smelt_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftIronChestplate(bot) {
  // Check if there are enough iron ingots in the inventory
  const ironIngotsCount = bot.inventory.count(mcData.itemsByName.iron_ingot.id);

  // If not enough iron ingots, mine iron ores and smelt them into iron ingots
  if (ironIngotsCount < 8) {
    await mineBlock(bot, "iron_ore", 8 - ironIngotsCount);
    bot.chat("Collected iron ores.");
    await smeltItem(bot, "iron_ore", "coal", 8 - ironIngotsCount);
    bot.chat("Smelted iron ores into iron ingots.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft an iron chestplate using the crafting table
  await craftItem(bot, "iron_chestplate", 1);
  bot.chat("Crafted an iron chestplate.");
}
```
