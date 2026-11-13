---
id: voyager-craft-furnace
title: craftFurnace
description: The function crafts a furnace using a crafting table and cobblestones. If there are not enough cobblestones in the inventory, it mines the required amount. Then, it places a crafting table near the bot and crafts a furnace using the crafting table. Finally, it sends a chat message indicating that a furnace has been crafted.
kind: code-reference
level: 2
when:
  - The function crafts a furnace using a crafting table and cobblestones
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
  path: skill_library/trial1/skill/code/craftFurnace.js
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

The function crafts a furnace using a crafting table and cobblestones. If there are not enough cobblestones in the inventory, it mines the required amount. Then, it places a crafting table near the bot and crafts a furnace using the crafting table. Finally, it sends a chat message indicating that a furnace has been crafted.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftFurnace(bot) {
  // Check if there are enough cobblestones in the inventory
  const cobblestoneCount = bot.inventory.count(mcData.itemsByName.cobblestone.id);

  // If not, mine the required cobblestones
  if (cobblestoneCount < 8) {
    await mineBlock(bot, "stone", 8 - cobblestoneCount);
    bot.chat("Collected cobblestone.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a furnace using the crafting table
  await craftItem(bot, "furnace", 1);
  bot.chat("Crafted a furnace.");
}
```
