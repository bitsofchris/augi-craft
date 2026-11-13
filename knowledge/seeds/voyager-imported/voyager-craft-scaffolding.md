---
id: voyager-craft-scaffolding
title: craftScaffolding
description: The function is about crafting 10 scaffolding using a crafting table. First, it checks if there is a crafting table in the inventory. If not, it crafts one. Then, it places the crafting table near the bot. After that, it crafts 10 scaffolding using the crafting table and saves the event.
kind: code-reference
level: 2
when:
  - The function is about crafting 10 scaffolding using a crafting table
prerequisites: []
depends_on:
  tools:
    - craft_item
    - place_block
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/craftScaffolding.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - craftItem
  - placeItem
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - craftitem
  - placeitem
---

## Summary

The function is about crafting 10 scaffolding using a crafting table. First, it checks if there is a crafting table in the inventory. If not, it crafts one. Then, it places the crafting table near the bot. After that, it crafts 10 scaffolding using the crafting table and saves the event.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftScaffolding(bot) {
  // Check if we have a crafting table in the inventory
  const craftingTableCount = bot.inventory.count(mcData.itemsByName.crafting_table.id);

  // If not, craft a crafting table
  if (craftingTableCount === 0) {
    await craftItem(bot, "crafting_table", 1);
    bot.chat("Crafted a crafting table.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft 10 scaffolding using the crafting table
  await craftItem(bot, "scaffolding", 1);
  bot.chat("Crafted 10 scaffolding.");
}
```
