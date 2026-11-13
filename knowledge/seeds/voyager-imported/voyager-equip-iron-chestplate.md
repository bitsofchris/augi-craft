---
id: voyager-equip-iron-chestplate
title: equipIronChestplate
description: The function is about equipping an iron chestplate on the bot's torso. It first finds the iron chestplate in the inventory and then equips it. If the iron chestplate is not found in the inventory, it sends a message saying that it was not found.
kind: code-reference
level: 2
when:
  - The function is about equipping an iron chestplate on the bot's torso
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/equipIronChestplate.js
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

The function is about equipping an iron chestplate on the bot's torso. It first finds the iron chestplate in the inventory and then equips it. If the iron chestplate is not found in the inventory, it sends a message saying that it was not found.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (see code), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function equipIronChestplate(bot) {
  // Find the iron chestplate in the inventory
  const ironChestplate = bot.inventory.findInventoryItem(mcData.itemsByName.iron_chestplate.id);

  // Equip the iron chestplate
  if (ironChestplate) {
    await bot.equip(ironChestplate, "torso");
    bot.chat("Equipped iron chestplate.");
  } else {
    bot.chat("Iron chestplate not found in inventory.");
  }
}
```
