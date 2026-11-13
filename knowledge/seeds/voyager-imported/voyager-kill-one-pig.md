---
id: voyager-kill-one-pig
title: killOnePig
description: The function is about killing a pig using a wooden sword and collecting the dropped items. First, equip the wooden sword in the hand. Next, explore the environment until finding the nearest pig within 32 blocks. Once a pig is found, kill it using the wooden sword and collect the dropped items by moving to the pig's position.
kind: code-reference
level: 2
when:
  - The function is about killing a pig using a wooden sword and collecting the dropped items
prerequisites: []
depends_on:
  tools:
    - navigate_to
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/killOnePig.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - killMob
  - exploreUntil
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - killmob
  - exploreuntil
---

## Summary

The function is about killing a pig using a wooden sword and collecting the dropped items. First, equip the wooden sword in the hand. Next, explore the environment until finding the nearest pig within 32 blocks. Once a pig is found, kill it using the wooden sword and collect the dropped items by moving to the pig's position.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function killOnePig(bot) {
  // Equip the wooden sword
  const woodenSword = bot.inventory.findInventoryItem(mcData.itemsByName.wooden_sword.id);
  await bot.equip(woodenSword, "hand");

  // Find the nearest pig
  const pig = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const pig = bot.nearestEntity(entity => {
      return entity.name === "pig" && entity.position.distanceTo(bot.entity.position) < 32;
    });
    return pig;
  });
  if (!pig) {
    bot.chat("Could not find a pig.");
    return;
  }

  // Kill the pig using the wooden sword
  await killMob(bot, "pig", 300);
  bot.chat("Killed a pig.");

  // Collect the dropped items
  await bot.pathfinder.goto(new GoalBlock(pig.position.x, pig.position.y, pig.position.z));
  bot.chat("Collected dropped items.");
}
```
