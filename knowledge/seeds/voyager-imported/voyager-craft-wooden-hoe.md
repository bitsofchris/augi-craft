---
id: voyager-craft-wooden-hoe
title: craftWoodenHoe
description: The function crafts a wooden hoe using oak planks and sticks. If there are not enough oak planks, it crafts them from oak logs. If there are not enough sticks, it crafts them from oak planks. Then, it places a crafting table near the bot and uses it to craft a wooden hoe.
kind: code-reference
level: 2
when:
  - The function crafts a wooden hoe using oak planks and sticks
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
  path: skill_library/trial1/skill/code/craftWoodenHoe.js
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

The function crafts a wooden hoe using oak planks and sticks. If there are not enough oak planks, it crafts them from oak logs. If there are not enough sticks, it crafts them from oak planks. Then, it places a crafting table near the bot and uses it to craft a wooden hoe.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftWoodenHoe(bot) {
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
  if (sticksCount < 2) {
    await craftItem(bot, "stick", 1);
    bot.chat("Crafted sticks.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a wooden hoe using the crafting table
  await craftItem(bot, "wooden_hoe", 1);
  bot.chat("Crafted a wooden hoe.");
}
```
