---
id: voyager-craft-acacia-planks-and-sticks
title: craftAcaciaPlanksAndSticks
description: The function is about crafting 20 acacia planks and 10 sticks. It checks if there are enough acacia logs in the inventory, and if not, it mines more acacia logs. Then it crafts 20 acacia planks from the acacia logs. If there are not enough acacia planks in the inventory to craft 10 sticks, it mines more acacia logs and crafts more acacia planks. Finally, it crafts 10 sticks from the acacia planks.
kind: code-reference
level: 2
when:
  - The function is about crafting 20 acacia planks and 10 sticks
prerequisites: []
depends_on:
  tools:
    - gather_blocks
    - craft_item
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/craftAcaciaPlanksAndSticks.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - mineBlock
  - craftItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - mineblock
  - craftitem
---

## Summary

The function is about crafting 20 acacia planks and 10 sticks. It checks if there are enough acacia logs in the inventory, and if not, it mines more acacia logs. Then it crafts 20 acacia planks from the acacia logs. If there are not enough acacia planks in the inventory to craft 10 sticks, it mines more acacia logs and crafts more acacia planks. Finally, it crafts 10 sticks from the acacia planks.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftAcaciaPlanksAndSticks(bot) {
  // Check if there are enough acacia logs in the inventory
  const acaciaLogsCount = bot.inventory.count(mcData.itemsByName.acacia_log.id);

  // If not, mine more acacia logs
  if (acaciaLogsCount < 5) {
    await mineBlock(bot, "acacia_log", 5 - acaciaLogsCount);
    bot.chat("Mined acacia logs.");
  }

  // Craft 20 acacia planks from acacia logs
  await craftItem(bot, "acacia_planks", 5);
  bot.chat("Crafted 20 acacia planks.");

  // Check if there are enough acacia planks in the inventory to craft 10 sticks
  const acaciaPlanksCount = bot.inventory.count(mcData.itemsByName.acacia_planks.id);

  // If not, mine more acacia logs and craft more acacia planks
  if (acaciaPlanksCount < 5) {
    await mineBlock(bot, "acacia_log", 5 - acaciaLogsCount);
    bot.chat("Mined more acacia logs.");
    await craftItem(bot, "acacia_planks", 5 - acaciaPlanksCount);
    bot.chat("Crafted more acacia planks.");
  }

  // Craft 10 sticks from acacia planks
  await craftItem(bot, "stick", 3);
  bot.chat("Crafted 10 sticks.");
}
```
