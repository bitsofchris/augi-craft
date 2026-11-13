---
id: voyager-craft-wooden-sword
title: craftWoodenSword
description: The function crafts a wooden sword using oak planks, sticks, and a crafting table. It checks if there are enough oak planks and sticks in the inventory, and crafts them if necessary. Then, it places a crafting table near the bot and uses it to craft a wooden sword.
kind: code-reference
level: 2
when:
  - The function crafts a wooden sword using oak planks, sticks, and a crafting table
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
  path: skill_library/trial1/skill/code/craftWoodenSword.js
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

The function crafts a wooden sword using oak planks, sticks, and a crafting table. It checks if there are enough oak planks and sticks in the inventory, and crafts them if necessary. Then, it places a crafting table near the bot and uses it to craft a wooden sword.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftWoodenSword(bot) {
  // Check if there are enough oak planks in the inventory
  const oakPlanksCount = bot.inventory.count(mcData.itemsByName.oak_planks.id);

  // If not, craft oak planks from oak logs
  if (oakPlanksCount < 2) {
    const oakLogsCount = bot.inventory.count(mcData.itemsByName.oak_log.id);
    const planksToCraft = Math.ceil((2 - oakPlanksCount) / 4);
    if (oakLogsCount >= planksToCraft) {
      await craftItem(bot, "oak_planks", planksToCraft);
      bot.chat("Crafted oak planks.");
    } else {
      bot.chat("Not enough oak logs to craft oak planks.");
      return;
    }
  }

  // Check if there are enough sticks in the inventory
  const sticksCount = bot.inventory.count(mcData.itemsByName.stick.id);

  // If not, craft sticks from oak planks
  if (sticksCount < 1) {
    await craftItem(bot, "stick", 1);
    bot.chat("Crafted sticks.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a wooden sword using the crafting table
  await craftItem(bot, "wooden_sword", 1);
  bot.chat("Crafted a wooden sword.");
}
```
