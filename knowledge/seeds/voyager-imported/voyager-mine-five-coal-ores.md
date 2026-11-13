---
id: voyager-mine-five-coal-ores
title: mineFiveCoalOres
description: The function is about mining 5 coal ores using a stone pickaxe. First, equip the stone pickaxe in the hand. Next, explore the environment until finding 5 coal_ore blocks. Once 5 coal_ore blocks are found, mine them using the stone pickaxe.
kind: code-reference
level: 2
when:
  - The function is about mining 5 coal ores using a stone pickaxe
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
  path: skill_library/trial1/skill/code/mineFiveCoalOres.js
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

The function is about mining 5 coal ores using a stone pickaxe. First, equip the stone pickaxe in the hand. Next, explore the environment until finding 5 coal_ore blocks. Once 5 coal_ore blocks are found, mine them using the stone pickaxe.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function mineFiveCoalOres(bot) {
  // Equip the stone pickaxe
  const stonePickaxe = bot.inventory.findInventoryItem(mcData.itemsByName.stone_pickaxe.id);
  await bot.equip(stonePickaxe, "hand");

  // Find 5 coal_ore blocks
  const coalOres = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const coalOres = bot.findBlocks({
      matching: block => block.name === "coal_ore",
      maxDistance: 32,
      count: 5
    });
    return coalOres.length >= 5 ? coalOres : null;
  });
  if (!coalOres) {
    bot.chat("Could not find enough coal ores.");
    return;
  }

  // Mine the 5 coal_ore blocks
  await mineBlock(bot, "coal_ore", 5);
  bot.chat("5 coal ores mined.");
}
```
