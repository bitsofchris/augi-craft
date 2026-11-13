---
id: voyager-kill-two-pigs
title: killTwoPigs
description: The function is about killing two pigs and collecting their dropped items. The function equips a wooden sword and kills two pigs using the `killMob` function. After killing each pig, the function logs a message. Then, the function searches for dropped items from the killed pigs and collects them using the `pathfinder` module. Finally, the function logs a message indicating that the items have been collected.
kind: code-reference
level: 2
when:
  - The function is about killing two pigs and collecting their dropped items
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/killTwoPigs.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - killMob
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - killmob
---

## Summary

The function is about killing two pigs and collecting their dropped items. The function equips a wooden sword and kills two pigs using the `killMob` function. After killing each pig, the function logs a message. Then, the function searches for dropped items from the killed pigs and collects them using the `pathfinder` module. Finally, the function logs a message indicating that the items have been collected.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (see code), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function killTwoPigs(bot) {
  // Equip the wooden sword
  const woodenSword = bot.inventory.findInventoryItem(mcData.itemsByName.wooden_sword.id);
  await bot.equip(woodenSword, "hand");

  // Find and kill the first pig
  await killMob(bot, "pig", 300);
  bot.chat("Killed the first pig.");

  // Find and kill the second pig
  await killMob(bot, "pig", 300);
  bot.chat("Killed the second pig.");

  // Collect the dropped items from the killed pigs
  const pigDrops = ["raw_porkchop"];
  for (const drop of pigDrops) {
    const droppedItem = bot.findBlock({
      matching: block => block.name === drop,
      maxDistance: 32
    });
    if (droppedItem) {
      await bot.pathfinder.goto(new GoalBlock(droppedItem.position.x, droppedItem.position.y, droppedItem.position.z));
    }
  }
  bot.chat("Collected dropped items from the killed pigs.");
}
```
