---
id: voyager-cook-porkchops
title: cookPorkchops
description: The function is about cooking 2 porkchops using a furnace and coal as fuel. First, it checks if there is a furnace in the inventory. If not, it crafts a furnace using cobblestone. Then, it places the furnace near the bot. Finally, it smelts 2 porkchops using coal as fuel and saves the event of cooking porkchops.
kind: code-reference
level: 2
when:
  - The function is about cooking 2 porkchops using a furnace and coal as fuel
prerequisites: []
depends_on:
  tools:
    - smelt_item
    - place_block
  skills:
    - voyager-craft-furnace
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/cookPorkchops.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - smeltItem
  - placeItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - smeltitem
  - placeitem
---

## Summary

The function is about cooking 2 porkchops using a furnace and coal as fuel. First, it checks if there is a furnace in the inventory. If not, it crafts a furnace using cobblestone. Then, it places the furnace near the bot. Finally, it smelts 2 porkchops using coal as fuel and saves the event of cooking porkchops.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (smelt_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function cookPorkchops(bot) {
  // Check if there is a furnace in the inventory
  const furnaceItem = bot.inventory.findInventoryItem(mcData.itemsByName.furnace.id);

  // If not, craft a furnace using the available cobblestone
  if (!furnaceItem) {
    await craftFurnace(bot);
  }

  // Place the furnace near the bot
  const furnacePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "furnace", furnacePosition);

  // Smelt 2 porkchops using the available coal as fuel
  await smeltItem(bot, "porkchop", "coal", 2);
  bot.chat("2 porkchops cooked.");
}
```
