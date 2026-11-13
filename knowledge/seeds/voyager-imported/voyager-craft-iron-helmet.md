---
id: voyager-craft-iron-helmet
title: craftIronHelmet
description: The function is about crafting an iron helmet using a crafting table. First, place the crafting table near the bot. Then, craft an iron helmet using the crafting table and save it to the inventory.
kind: code-reference
level: 2
when:
  - The function is about crafting an iron helmet using a crafting table
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
  path: skill_library/trial1/skill/code/craftIronHelmet.js
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

The function is about crafting an iron helmet using a crafting table. First, place the crafting table near the bot. Then, craft an iron helmet using the crafting table and save it to the inventory.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftIronHelmet(bot) {
  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft an iron helmet using the crafting table
  await craftItem(bot, "iron_helmet", 1);
  bot.chat("Crafted an iron helmet.");
}
```
