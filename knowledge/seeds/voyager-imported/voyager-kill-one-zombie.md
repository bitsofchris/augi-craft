---
id: voyager-kill-one-zombie
title: killOneZombie
description: The function is about killing a single zombie using an iron sword. First, equip the iron sword in the hand. Then, explore the environment until finding the nearest zombie within 32 blocks. Once a zombie is found, kill it using the iron sword and collect the dropped items.
kind: code-reference
level: 2
when:
  - The function is about killing a single zombie using an iron sword
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
  path: skill_library/trial1/skill/code/killOneZombie.js
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

The function is about killing a single zombie using an iron sword. First, equip the iron sword in the hand. Then, explore the environment until finding the nearest zombie within 32 blocks. Once a zombie is found, kill it using the iron sword and collect the dropped items.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function killOneZombie(bot) {
  // Equip the iron sword
  const ironSword = bot.inventory.findInventoryItem(mcData.itemsByName.iron_sword.id);
  await bot.equip(ironSword, "hand");

  // Find the nearest zombie
  const zombie = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const zombie = bot.nearestEntity(entity => {
      return entity.name === "zombie" && entity.position.distanceTo(bot.entity.position) < 32;
    });
    return zombie;
  });
  if (!zombie) {
    bot.chat("Could not find a zombie.");
    return;
  }

  // Kill the zombie using the iron sword
  await killMob(bot, "zombie", 300);
  bot.chat("Killed a zombie.");

  // Collect the dropped items
  await bot.pathfinder.goto(new GoalBlock(zombie.position.x, zombie.position.y, zombie.position.z));
  bot.chat("Collected dropped items.");
}
```
