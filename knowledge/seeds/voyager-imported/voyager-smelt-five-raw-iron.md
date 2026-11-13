---
id: voyager-smelt-five-raw-iron
title: smeltFiveRawIron
description: The function is about smelting 5 raw iron using a furnace and coal as fuel. If there is no furnace in the inventory, craft one using cobblestone. Find a suitable position to place the furnace and place it there. Then, smelt 5 raw iron using the available coal as fuel.
kind: code-reference
level: 2
when:
  - The function is about smelting 5 raw iron using a furnace and coal as fuel
prerequisites: []
depends_on:
  tools:
    - gather_blocks
    - smelt_item
    - place_block
  skills:
    - voyager-craft-furnace
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/smeltFiveRawIron.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - mineBlock
  - smeltItem
  - placeItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - mineblock
  - smeltitem
  - placeitem
---

## Summary

The function is about smelting 5 raw iron using a furnace and coal as fuel. If there is no furnace in the inventory, craft one using cobblestone. Find a suitable position to place the furnace and place it there. Then, smelt 5 raw iron using the available coal as fuel.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, smelt_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function findSuitablePosition(bot) {
  const offsets = [new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1)];
  for (const offset of offsets) {
    const position = bot.entity.position.offset(offset.x, offset.y, offset.z);
    const block = bot.blockAt(position);
    if (block.name === "air") {
      return position;
    }
  }
  return null;
}
async function smeltFiveRawIron(bot) {
  // Check if there is coal in the inventory
  const coalCount = bot.inventory.count(mcData.itemsByName.coal.id);

  // If not enough coal, mine coal_ore to obtain coal
  if (coalCount < 3) {
    await mineBlock(bot, "coal_ore", 3 - coalCount);
    bot.chat("Collected coal.");
  }
  // Check if there is a furnace in the inventory
  const furnaceItem = bot.inventory.findInventoryItem(mcData.itemsByName.furnace.id);
  // If not, craft a furnace using the available cobblestone
  if (!furnaceItem) {
    await craftFurnace(bot);
  }
  // Find a suitable position to place the furnace
  const furnacePosition = await findSuitablePosition(bot);
  if (!furnacePosition) {
    bot.chat("Could not find a suitable position to place the furnace.");
    return;
  }
  // Place the furnace at the suitable position
  await placeItem(bot, "furnace", furnacePosition);
  // Smelt 5 raw iron using the available coal as fuel
  await smeltItem(bot, "raw_iron", "coal", 5);
  bot.chat("5 raw iron smelted.");
}
```
