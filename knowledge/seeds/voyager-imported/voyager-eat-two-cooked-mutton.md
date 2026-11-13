---
id: voyager-eat-two-cooked-mutton
title: eatTwoCookedMutton
description: The function is about eating two cooked muttons. It checks if there are at least 2 cooked muttons in the inventory, and if not, it returns. If there are 2 or more cooked muttons, it equips one in the bot's hand and consumes it twice. Finally, it sends a chat message to indicate that the task is completed.
kind: code-reference
level: 2
when:
  - The function is about eating two cooked muttons
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/eatTwoCookedMutton.js
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

The function is about eating two cooked muttons. It checks if there are at least 2 cooked muttons in the inventory, and if not, it returns. If there are 2 or more cooked muttons, it equips one in the bot's hand and consumes it twice. Finally, it sends a chat message to indicate that the task is completed.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (see code), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function eatTwoCookedMutton(bot) {
  // Check if there are 2 cooked mutton in the inventory
  const cookedMutton = bot.inventory.findInventoryItem(mcData.itemsByName.cooked_mutton.id);
  if (!cookedMutton || cookedMutton.count < 2) {
    bot.chat("Not enough cooked mutton in the inventory.");
    return;
  }

  // Equip the cooked mutton in the bot's hand
  await bot.equip(cookedMutton, "hand");

  // Consume the cooked mutton twice
  await bot.consume();
  await bot.consume();

  // Send a chat message to indicate the task is completed
  bot.chat("Ate 2 cooked mutton.");
}
```
