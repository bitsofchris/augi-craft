---
id: voyager-craft-oak-planks-and-sticks
title: craftOakPlanksAndSticks
description: The function checks if there are enough oak planks and sticks in the inventory, and crafts them if necessary. If there are not enough oak planks, it crafts them from oak logs. If there are not enough sticks, it crafts them from oak planks.
kind: code-reference
level: 2
when:
  - The function checks if there are enough oak planks and sticks in the inventory, and crafts them if necessary
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
  path: skill_library/trial1/skill/code/craftOakPlanksAndSticks.js
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

The function checks if there are enough oak planks and sticks in the inventory, and crafts them if necessary. If there are not enough oak planks, it crafts them from oak logs. If there are not enough sticks, it crafts them from oak planks.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (craft_item), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftOakPlanksAndSticks(bot) {
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

  // Check if there are enough sticks in the inventory
  const sticksCount = bot.inventory.count(mcData.itemsByName.stick.id);

  // If not, craft sticks from oak planks
  if (sticksCount < 4) {
    await craftItem(bot, "stick", 2);
    bot.chat("Crafted sticks.");
  }
}
```
