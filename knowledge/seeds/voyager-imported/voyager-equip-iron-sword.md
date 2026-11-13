---
id: voyager-equip-iron-sword
title: equipIronSword
description: The function is about equipping an iron sword. It first checks if the iron sword is in the inventory. If not, it checks a chest for the iron sword. If the iron sword is found, it is equipped in the hand. If the iron sword is not found, a message is sent to the chat.
kind: code-reference
level: 2
when:
  - The function is about equipping an iron sword
prerequisites: []
depends_on:
  tools:
    - withdraw_items
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/equipIronSword.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - getItemFromChest
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - getitemfromchest
---

## Summary

The function is about equipping an iron sword. It first checks if the iron sword is in the inventory. If not, it checks a chest for the iron sword. If the iron sword is found, it is equipped in the hand. If the iron sword is not found, a message is sent to the chat.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (withdraw_items), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function equipIronSword(bot) {
  // Find the iron sword in the inventory
  let ironSword = bot.inventory.findInventoryItem(mcData.itemsByName.iron_sword.id);

  // If the iron sword is not found in the inventory, check the chest
  if (!ironSword) {
    const chestPosition = new Vec3(89, 41, 206);
    const itemsToGet = {
      "iron_sword": 1
    };
    await getItemFromChest(bot, chestPosition, itemsToGet);
    ironSword = bot.inventory.findInventoryItem(mcData.itemsByName.iron_sword.id);
  }

  // Equip the iron sword
  if (ironSword) {
    await bot.equip(ironSword, "hand");
    bot.chat("Equipped iron sword.");
  } else {
    bot.chat("Iron sword not found in inventory or chest.");
  }
}
```
