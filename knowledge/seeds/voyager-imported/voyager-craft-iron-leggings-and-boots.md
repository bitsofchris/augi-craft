---
id: voyager-craft-iron-leggings-and-boots
title: craftIronLeggingsAndBoots
description: The function crafts iron leggings and boots using a crafting table. If there are not enough iron ingots in the inventory, the bot mines iron ores and smelts them into iron ingots. Then, the bot places a crafting table near itself and crafts iron leggings and boots using the crafting table.
kind: code-reference
level: 2
when:
  - The function crafts iron leggings and boots using a crafting table
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
  path: skill_library/trial1/skill/code/craftIronLeggingsAndBoots.js
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

The function crafts iron leggings and boots using a crafting table. If there are not enough iron ingots in the inventory, the bot mines iron ores and smelts them into iron ingots. Then, the bot places a crafting table near itself and crafts iron leggings and boots using the crafting table.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, smelt_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftIronLeggingsAndBoots(bot) {
  // Check if there are enough iron ingots in the inventory
  const ironIngotsCount = bot.inventory.count(mcData.itemsByName.iron_ingot.id);

  // If not enough iron ingots, mine iron ores and smelt them into iron ingots
  if (ironIngotsCount < 11) {
    await mineBlock(bot, "iron_ore", 11 - ironIngotsCount);
    bot.chat("Collected iron ores.");
    await smeltItem(bot, "iron_ore", "coal", 11 - ironIngotsCount);
    bot.chat("Smelted iron ores into iron ingots.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft iron leggings using the crafting table
  await craftItem(bot, "iron_leggings", 1);
  bot.chat("Crafted iron leggings.");

  // Craft iron boots using the crafting table
  await craftItem(bot, "iron_boots", 1);
  bot.chat("Crafted iron boots.");
}
```
