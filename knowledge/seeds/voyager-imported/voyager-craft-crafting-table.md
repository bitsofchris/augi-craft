---
id: voyager-craft-crafting-table
title: craftCraftingTable
description: The function crafts a crafting table using oak planks. It first checks if there are enough oak planks in the inventory, and if not, crafts oak planks from oak logs. Then, it crafts a crafting table using the oak planks.
kind: code-reference
level: 2
when:
  - The function crafts a crafting table using oak planks
prerequisites: []
depends_on:
  tools:
    - craft_item
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/craftCraftingTable.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - craftItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - craftitem
---

## Summary

The function crafts a crafting table using oak planks. It first checks if there are enough oak planks in the inventory, and if not, crafts oak planks from oak logs. Then, it crafts a crafting table using the oak planks.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (craft_item), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftCraftingTable(bot) {
  // Check if there are enough oak planks in the inventory
  const oakPlanksCount = bot.inventory.count(mcData.itemsByName.oak_planks.id);

  // If not, craft oak planks from oak logs
  if (oakPlanksCount < 4) {
    const oakLogsCount = bot.inventory.count(mcData.itemsByName.oak_log.id);
    const planksToCraft = Math.ceil((4 - oakPlanksCount) / 4);
    if (oakLogsCount >= planksToCraft) {
      await craftItem(bot, "oak_planks", planksToCraft);
      bot.chat("Crafted oak planks.");
    } else {
      bot.chat("Not enough oak logs to craft oak planks.");
      return;
    }
  }

  // Craft a crafting table using oak planks
  await craftItem(bot, "crafting_table", 1);
  bot.chat("Crafted a crafting table.");
}
```
