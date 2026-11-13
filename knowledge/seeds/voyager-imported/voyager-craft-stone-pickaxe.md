---
id: voyager-craft-stone-pickaxe
title: craftStonePickaxe
description: The function crafts a stone pickaxe using cobblestone and sticks. It checks if there are enough cobblestone and sticks in the inventory, and if not, it collects the required items. Then, it places a crafting table near the bot and crafts a stone pickaxe using the crafting table.
kind: code-reference
level: 2
when:
  - The function crafts a stone pickaxe using cobblestone and sticks
prerequisites: []
depends_on:
  tools:
    - gather_blocks
    - craft_item
    - place_block
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/craftStonePickaxe.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - mineBlock
  - craftItem
  - placeItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - mineblock
  - craftitem
  - placeitem
---

## Summary

The function crafts a stone pickaxe using cobblestone and sticks. It checks if there are enough cobblestone and sticks in the inventory, and if not, it collects the required items. Then, it places a crafting table near the bot and crafts a stone pickaxe using the crafting table.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftStonePickaxe(bot) {
  // Check if there are enough cobblestone and sticks in the inventory
  const cobblestoneCount = bot.inventory.count(mcData.itemsByName.cobblestone.id);
  const sticksCount = bot.inventory.count(mcData.itemsByName.stick.id);

  // If not enough cobblestone or sticks, collect the required items
  if (cobblestoneCount < 3) {
    await mineBlock(bot, "stone", 3 - cobblestoneCount);
    bot.chat("Collected cobblestone.");
  }
  if (sticksCount < 2) {
    await craftItem(bot, "stick", 1);
    bot.chat("Crafted sticks.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a stone pickaxe using the crafting table
  await craftItem(bot, "stone_pickaxe", 1);
  bot.chat("Crafted a stone pickaxe.");
}
```
