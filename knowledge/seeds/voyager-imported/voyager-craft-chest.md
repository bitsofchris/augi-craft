---
id: voyager-craft-chest
title: craftChest
description: The function crafts a chest using a crafting table and oak planks. If there are not enough oak planks in the inventory, it crafts oak planks from oak logs. Once there are enough oak planks, it places a crafting table near the bot and crafts a chest using the crafting table.
kind: code-reference
level: 2
when:
  - The function crafts a chest using a crafting table and oak planks
prerequisites: []
depends_on:
  tools:
    - craft_item
    - place_block
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/craftChest.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - craftItem
  - placeItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - craftitem
  - placeitem
---

## Summary

The function crafts a chest using a crafting table and oak planks. If there are not enough oak planks in the inventory, it crafts oak planks from oak logs. Once there are enough oak planks, it places a crafting table near the bot and crafts a chest using the crafting table.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftChest(bot) {
  // Check if there are enough oak planks in the inventory
  const oakPlanksCount = bot.inventory.count(mcData.itemsByName.oak_planks.id);

  // If not, craft oak planks from oak logs
  if (oakPlanksCount < 8) {
    const oakLogsCount = bot.inventory.count(mcData.itemsByName.oak_log.id);
    const planksToCraft = Math.ceil((8 - oakPlanksCount) / 4);
    if (oakLogsCount >= planksToCraft) {
      await craftItem(bot, "oak_planks", planksToCraft);
      bot.chat("Crafted oak planks.");
    } else {
      bot.chat("Not enough oak logs to craft oak planks.");
      return;
    }
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a chest using the crafting table
  await craftItem(bot, "chest", 1);
  bot.chat("Crafted a chest.");
}
```
