---
id: voyager-craft-stone-shovel
title: craftStoneShovel
description: The function crafts a stone shovel using cobblestone and sticks. It checks if there are enough cobblestone and sticks in the inventory, and if not, it mines cobblestone or crafts sticks. Then, it places a crafting table near the bot and crafts a stone shovel using the crafting table. Finally, it sends a chat message indicating that a stone shovel has been crafted.
kind: code-reference
level: 2
when:
  - The function crafts a stone shovel using cobblestone and sticks
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
  path: skill_library/trial1/skill/code/craftStoneShovel.js
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

The function crafts a stone shovel using cobblestone and sticks. It checks if there are enough cobblestone and sticks in the inventory, and if not, it mines cobblestone or crafts sticks. Then, it places a crafting table near the bot and crafts a stone shovel using the crafting table. Finally, it sends a chat message indicating that a stone shovel has been crafted.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftStoneShovel(bot) {
  // Check if there are enough cobblestone and sticks in the inventory
  const cobblestoneCount = bot.inventory.count(mcData.itemsByName.cobblestone.id);
  const sticksCount = bot.inventory.count(mcData.itemsByName.stick.id);

  // If not enough cobblestone, mine cobblestone
  if (cobblestoneCount < 1) {
    await mineBlock(bot, "stone", 1);
    bot.chat("Collected cobblestone.");
  }

  // If not enough sticks, craft sticks
  if (sticksCount < 2) {
    await craftItem(bot, "stick", 1);
    bot.chat("Crafted sticks.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a stone shovel using the crafting table
  await craftItem(bot, "stone_shovel", 1);
  bot.chat("Crafted a stone shovel.");
}
```
