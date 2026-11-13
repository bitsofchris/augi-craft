---
id: voyager-collect-bamboo
title: collectBamboo
description: The function is about collecting 10 bamboo plants. It equips the iron sword and uses the `exploreUntil` function to find 10 bamboo plants within a certain distance. If enough bamboo plants are found, it breaks them using the iron sword and collects the dropped bamboo items by moving to their location. If not enough bamboo plants are found, it returns an error message.
kind: code-reference
level: 2
when:
  - The function is about collecting 10 bamboo plants
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
  path: skill_library/trial1/skill/code/collectBamboo.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - exploreUntil
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - exploreuntil
---

## Summary

The function is about collecting 10 bamboo plants. It equips the iron sword and uses the `exploreUntil` function to find 10 bamboo plants within a certain distance. If enough bamboo plants are found, it breaks them using the iron sword and collects the dropped bamboo items by moving to their location. If not enough bamboo plants are found, it returns an error message.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function collectBamboo(bot) {
  // Equip the iron sword
  const ironSword = bot.inventory.findInventoryItem(mcData.itemsByName.iron_sword.id);
  await bot.equip(ironSword, "hand");

  // Find bamboo plants using the exploreUntil function
  const bambooPlants = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const bambooPlants = bot.findBlocks({
      matching: block => block.name === "bamboo",
      maxDistance: 32,
      count: 10
    });
    return bambooPlants.length >= 10 ? bambooPlants : null;
  });
  if (!bambooPlants) {
    bot.chat("Could not find enough bamboo plants.");
    return;
  }

  // Break 10 bamboo plants using the iron sword
  for (const bambooPlant of bambooPlants) {
    const block = bot.blockAt(bambooPlant);
    await bot.dig(block);
  }
  bot.chat("Broke 10 bamboo plants.");

  // Collect the dropped bamboo items
  for (const bambooPlant of bambooPlants) {
    await bot.pathfinder.goto(new GoalBlock(bambooPlant.x, bambooPlant.y, bambooPlant.z));
  }
  bot.chat("Collected 10 bamboo.");
}
```
