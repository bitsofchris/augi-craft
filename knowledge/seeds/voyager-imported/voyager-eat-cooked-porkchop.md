---
id: voyager-eat-cooked-porkchop
title: eatCookedPorkchop
description: The function is about eating a cooked porkchop. It equips the cooked porkchop in the bot's hand, consumes it, and sends a chat message to indicate the task is completed.
kind: code-reference
level: 2
when:
  - The function is about eating a cooked porkchop
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/eatCookedPorkchop.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives: []
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
---

## Summary

The function is about eating a cooked porkchop. It equips the cooked porkchop in the bot's hand, consumes it, and sends a chat message to indicate the task is completed.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (see code), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function eatCookedPorkchop(bot) {
  // Equip the cooked porkchop in the bot's hand
  const cookedPorkchop = bot.inventory.findInventoryItem(mcData.itemsByName.cooked_porkchop.id);
  await bot.equip(cookedPorkchop, "hand");

  // Consume the cooked porkchop
  await bot.consume();

  // Send a chat message to indicate the task is completed
  bot.chat("Ate 1 cooked porkchop.");
}
```
