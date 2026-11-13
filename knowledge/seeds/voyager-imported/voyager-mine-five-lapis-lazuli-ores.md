---
id: voyager-mine-five-lapis-lazuli-ores
title: mineFiveLapisLazuliOres
description: The function is about mining 5 lapis lazuli ores using an iron pickaxe. First, equip the iron pickaxe in the hand. Next, explore the environment until finding 5 lapis lazuli ore blocks. Once 5 lapis lazuli ore blocks are found, mine them using the iron pickaxe.
kind: code-reference
level: 2
when:
  - The function is about mining 5 lapis lazuli ores using an iron pickaxe
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
  path: skill_library/trial1/skill/code/mineFiveLapisLazuliOres.js
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

The function is about mining 5 lapis lazuli ores using an iron pickaxe. First, equip the iron pickaxe in the hand. Next, explore the environment until finding 5 lapis lazuli ore blocks. Once 5 lapis lazuli ore blocks are found, mine them using the iron pickaxe.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function mineFiveLapisLazuliOres(bot) {
  // Equip the iron pickaxe
  const ironPickaxe = bot.inventory.findInventoryItem(mcData.itemsByName.iron_pickaxe.id);
  await bot.equip(ironPickaxe, "hand");

  // Find 5 lapis_lazuli_ore blocks
  const lapisOres = await exploreUntil(bot, new Vec3(1, -1, 1), 60, () => {
    const lapisOres = bot.findBlocks({
      matching: block => block.name === "lapis_ore",
      maxDistance: 32,
      count: 5
    });
    return lapisOres.length >= 5 ? lapisOres : null;
  });
  if (!lapisOres) {
    bot.chat("Could not find enough lapis lazuli ores.");
    return;
  }

  // Mine the 5 lapis_lazuli_ore blocks
  await mineBlock(bot, "lapis_ore", 5);
  bot.chat("5 lapis lazuli ores mined.");
}
```
