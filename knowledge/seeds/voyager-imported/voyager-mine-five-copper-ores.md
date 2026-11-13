---
id: voyager-mine-five-copper-ores
title: mineFiveCopperOres
description: The function checks if the bot already has 5 or more copper ores in the inventory. If not, it outputs how many more copper ores are needed to complete the task.
kind: code-reference
level: 2
when:
  - The function checks if the bot already has 5 or more copper ores in the inventory
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/mineFiveCopperOres.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives: []
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
---

## Summary

The function checks if the bot already has 5 or more copper ores in the inventory. If not, it outputs how many more copper ores are needed to complete the task.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (see code), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function mineFiveCopperOres(bot) {
  // Check if the bot already has 5 or more copper ores in the inventory
  const copperOres = bot.inventory.items().filter(item => item.name === "copper_ore");
  const totalCopperOres = copperOres.reduce((total, item) => total + item.count, 0);
  if (totalCopperOres >= 5) {
    bot.chat("Task already completed. There are already " + totalCopperOres + " copper ores in the inventory.");
  } else {
    bot.chat("Need to mine " + (5 - totalCopperOres) + " more copper ores.");
    // You can call the mineFiveCopperOres function from the previous response here
  }
}
```
