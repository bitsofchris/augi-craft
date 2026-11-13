---
id: voyager-mine-ten-cobblestone
title: mineTenCobblestone
description: The function is about mining 10 cobblestones using a pickaxe. First, check if the bot has a pickaxe in the inventory. If not, craft a wooden pickaxe using the available resources in the inventory. If the pickaxe is available, equip the pickaxe in the hand. Next, use the exploreUntil function to find cobblestone blocks. Once 10 cobblestone blocks are found, mine them using the mineBlock function.
kind: code-reference
level: 2
when:
  - The function is about mining 10 cobblestones using a pickaxe
prerequisites: []
depends_on:
  tools:
    - gather_blocks
    - navigate_to
  skills:
    - voyager-craft-wooden-pickaxe
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/mineTenCobblestone.js
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

The function is about mining 10 cobblestones using a pickaxe. First, check if the bot has a pickaxe in the inventory. If not, craft a wooden pickaxe using the available resources in the inventory. If the pickaxe is available, equip the pickaxe in the hand. Next, use the exploreUntil function to find cobblestone blocks. Once 10 cobblestone blocks are found, mine them using the mineBlock function.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function mineTenCobblestone(bot) {
  // Check if the bot has a pickaxe in the inventory
  const pickaxe = bot.inventory.items().find(item => item.name.endsWith("_pickaxe"));

  // If not, craft a wooden pickaxe using the available resources in the inventory
  if (!pickaxe) {
    await craftWoodenPickaxe(bot);
  } else {
    // Equip the pickaxe
    await bot.equip(pickaxe, "hand");
  }

  // Use the exploreUntil function to find cobblestone blocks
  const cobblestoneBlocks = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const cobblestoneBlocks = bot.findBlocks({
      matching: block => block.name === "stone",
      maxDistance: 32,
      count: 10
    });
    return cobblestoneBlocks.length >= 10 ? cobblestoneBlocks : null;
  });
  if (!cobblestoneBlocks) {
    bot.chat("Could not find enough cobblestone.");
    return;
  }

  // Mine 10 cobblestone blocks using the mineBlock function
  await mineBlock(bot, "stone", 10);
  bot.chat("10 cobblestone mined.");
}
```
