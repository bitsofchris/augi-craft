---
id: voyager-kill-four-sheep
title: killFourSheep
description: The function is about killing four sheep and collecting their drops. It equips a wooden sword and kills the first three sheep, then kills the fourth sheep. After that, it collects the dropped items from the killed sheep, which include wool and raw mutton.
kind: code-reference
level: 2
when:
  - The function is about killing four sheep and collecting their drops
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/killFourSheep.js
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

The function is about killing four sheep and collecting their drops. It equips a wooden sword and kills the first three sheep, then kills the fourth sheep. After that, it collects the dropped items from the killed sheep, which include wool and raw mutton.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (see code), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function killFourSheep(bot) {
  // Equip the wooden sword
  const woodenSword = bot.inventory.findInventoryItem(mcData.itemsByName.wooden_sword.id);
  await bot.equip(woodenSword, "hand");

  // Find and kill the first three sheep
  for (let i = 1; i <= 3; i++) {
    await killMob(bot, "sheep", 300);
    bot.chat(`Killed sheep ${i}.`);
  }

  // Find and kill the fourth sheep
  await killMob(bot, "sheep", 300);
  bot.chat("Killed the fourth sheep.");

  // Collect the dropped items from the killed sheep
  const sheepDrops = ["wool", "raw_mutton"];
  for (const drop of sheepDrops) {
    const droppedItem = bot.findBlock({
      matching: block => block.name === drop,
      maxDistance: 32
    });
    if (droppedItem) {
      await bot.pathfinder.goto(new GoalBlock(droppedItem.position.x, droppedItem.position.y, droppedItem.position.z));
    }
  }
  bot.chat("Collected dropped items from the killed sheep.");
}
```
