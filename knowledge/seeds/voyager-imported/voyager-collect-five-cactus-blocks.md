---
id: voyager-collect-five-cactus-blocks
title: collectFiveCactusBlocks
description: The function is about collecting 5 cactus blocks using an iron pickaxe. First, equip the iron pickaxe in the hand. Next, explore the environment until finding 5 cactus blocks using the `exploreUntil` function. If 5 cactus blocks are not found, return. Otherwise, mine the 5 cactus blocks using the `mineBlock` function. Finally, collect the dropped cactus items by moving to each block's location.
kind: code-reference
level: 2
when:
  - The function is about collecting 5 cactus blocks using an iron pickaxe
prerequisites: []
depends_on:
  tools:
    - gather_blocks
    - navigate_to
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/collectFiveCactusBlocks.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - mineBlock
  - exploreUntil
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - mineblock
  - exploreuntil
---

## Summary

The function is about collecting 5 cactus blocks using an iron pickaxe. First, equip the iron pickaxe in the hand. Next, explore the environment until finding 5 cactus blocks using the `exploreUntil` function. If 5 cactus blocks are not found, return. Otherwise, mine the 5 cactus blocks using the `mineBlock` function. Finally, collect the dropped cactus items by moving to each block's location.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function collectFiveCactusBlocks(bot) {
  // Equip the iron pickaxe
  const ironPickaxe = bot.inventory.findInventoryItem(mcData.itemsByName.iron_pickaxe.id);
  await bot.equip(ironPickaxe, "hand");

  // Find 5 cactus blocks using the exploreUntil function
  const cactusBlocks = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const cactusBlocks = bot.findBlocks({
      matching: block => block.name === "cactus",
      maxDistance: 32,
      count: 5
    });
    return cactusBlocks.length >= 5 ? cactusBlocks : null;
  });
  if (!cactusBlocks) {
    bot.chat("Could not find enough cactus blocks.");
    return;
  }

  // Mine the 5 cactus blocks using the mineBlock function
  await mineBlock(bot, "cactus", 5);
  bot.chat("5 cactus blocks mined.");

  // Collect the dropped cactus items
  for (const cactusBlock of cactusBlocks) {
    await bot.pathfinder.goto(new GoalBlock(cactusBlock.x, cactusBlock.y, cactusBlock.z));
  }
  bot.chat("Collected 5 cactus blocks.");
}
```
