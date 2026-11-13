---
id: voyager-kill-one-enderman
title: killOneEnderman
description: The function is about killing one enderman using an iron sword. First, equip the iron sword in the hand. Next, explore the environment until finding the nearest enderman within 32 blocks. Once an enderman is found, kill it using the iron sword. After killing the enderman, collect the dropped items by moving to the enderman's position.
kind: code-reference
level: 2
when:
  - The function is about killing one enderman using an iron sword
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
  path: skill_library/trial1/skill/code/killOneEnderman.js
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

The function is about killing one enderman using an iron sword. First, equip the iron sword in the hand. Next, explore the environment until finding the nearest enderman within 32 blocks. Once an enderman is found, kill it using the iron sword. After killing the enderman, collect the dropped items by moving to the enderman's position.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function killOneEnderman(bot) {
  // Equip the iron sword
  const ironSword = bot.inventory.findInventoryItem(mcData.itemsByName.iron_sword.id);
  await bot.equip(ironSword, "hand");

  // Find the nearest enderman
  const enderman = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const enderman = bot.nearestEntity(entity => {
      return entity.name === "enderman" && entity.position.distanceTo(bot.entity.position) < 32;
    });
    return enderman;
  });
  if (!enderman) {
    bot.chat("Could not find an enderman.");
    return;
  }

  // Kill the enderman using the iron sword
  await killMob(bot, "enderman", 300);
  bot.chat("Killed an enderman.");

  // Collect the dropped items
  await bot.pathfinder.goto(new GoalBlock(enderman.position.x, enderman.position.y, enderman.position.z));
  bot.chat("Collected dropped items.");
}
```
