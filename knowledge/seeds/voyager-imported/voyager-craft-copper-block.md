---
id: voyager-craft-copper-block
title: craftCopperBlock
description: The function crafts a copper block using a crafting table. It first checks if there are enough copper ingots in the inventory, and if not, it mines copper ores and smelts them into copper ingots. Then it places a crafting table near the bot and crafts a copper block using the crafting table.
kind: code-reference
level: 2
when:
  - The function crafts a copper block using a crafting table
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
  path: skill_library/trial1/skill/code/craftCopperBlock.js
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

The function crafts a copper block using a crafting table. It first checks if there are enough copper ingots in the inventory, and if not, it mines copper ores and smelts them into copper ingots. Then it places a crafting table near the bot and crafts a copper block using the crafting table.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, smelt_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftCopperBlock(bot) {
  // Check if there are enough copper ingots in the inventory
  const copperIngotsCount = bot.inventory.count(mcData.itemsByName.copper_ingot.id);

  // If not enough copper ingots, mine copper ores and smelt them into copper ingots
  if (copperIngotsCount < 9) {
    await mineBlock(bot, "copper_ore", 9 - copperIngotsCount);
    bot.chat("Collected copper ores.");
    await smeltItem(bot, "copper_ore", "coal", 9 - copperIngotsCount);
    bot.chat("Smelted copper ores into copper ingots.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a copper block using the crafting table
  await craftItem(bot, "copper_block", 1);
  bot.chat("Crafted a copper block.");
}
```
