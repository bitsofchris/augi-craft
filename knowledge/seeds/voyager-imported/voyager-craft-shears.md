---
id: voyager-craft-shears
title: craftShears
description: The function is about crafting a pair of shears. First, place a crafting table near the bot. Then, craft a pair of shears using the crafting table. Finally, the bot will chat that it has crafted a pair of shears.
kind: code-reference
level: 2
when:
  - The function is about crafting a pair of shears
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
  path: skill_library/trial1/skill/code/craftShears.js
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

The function is about crafting a pair of shears. First, place a crafting table near the bot. Then, craft a pair of shears using the crafting table. Finally, the bot will chat that it has crafted a pair of shears.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (craft_item, place_block), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftShears(bot) {
  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a pair of shears using the crafting table
  await craftItem(bot, "shears", 1);
  bot.chat("Crafted a pair of shears.");
}
```
