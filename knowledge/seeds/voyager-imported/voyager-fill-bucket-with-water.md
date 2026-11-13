---
id: voyager-fill-bucket-with-water
title: fillBucketWithWater
description: This function fills a bucket with water by first finding a nearby water block. After locating the water block, the bot moves to it and equips the bucket in its hand. The bot then looks at the water block and activates the bucket to collect water.
kind: code-reference
level: 2
when:
  - This function fills a bucket with water by first finding a nearby water block
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
  path: skill_library/trial1/skill/code/fillBucketWithWater.js
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

This function fills a bucket with water by first finding a nearby water block. After locating the water block, the bot moves to it and equips the bucket in its hand. The bot then looks at the water block and activates the bucket to collect water.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function fillBucketWithWater(bot) {
  // Find a water block nearby
  const waterBlock = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const water = bot.findBlock({
      matching: mcData.blocksByName.water.id,
      maxDistance: 32,
    });
    return water;
  });
  if (!waterBlock) {
    bot.chat("Could not find water.");
    return;
  }

  const adjacentBlock = waterBlock.position.offset(0, 1, 0);
  // Go to the water block
  await bot.pathfinder.goto(
    new GoalGetToBlock(adjacentBlock.x, adjacentBlock.y, adjacentBlock.z)
  );

  // Equip the bucket
  const bucket = bot.inventory.findInventoryItem(mcData.itemsByName.bucket.id);
  await bot.equip(bucket, "hand");

  // Look at the water block
  await bot.lookAt(waterBlock.position);

  // Activate the bucket to collect water
  await bot.activateItem();
  bot.chat("Filled the bucket with water.");
}
```
