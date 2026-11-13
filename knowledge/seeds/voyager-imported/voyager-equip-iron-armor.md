---
id: voyager-equip-iron-armor
title: equipIronArmor
description: The function is about equipping iron armor (leggings, boots, and helmet) in the appropriate slots (legs, feet, and head) if they are available in the inventory. If any of the items are not found in the inventory, the function will output a message indicating that the item is not available.
kind: code-reference
level: 2
when:
  - The function is about equipping iron armor (leggings, boots, and helmet) in the appropriate slots (legs, feet, and head) if they are available in the inventory
prerequisites: []
depends_on:
  tools: []
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/equipIronArmor.js
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

The function is about equipping iron armor (leggings, boots, and helmet) in the appropriate slots (legs, feet, and head) if they are available in the inventory. If any of the items are not found in the inventory, the function will output a message indicating that the item is not available.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (see code), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function equipIronArmor(bot) {
  // Find the iron_leggings, iron_boots, and iron_helmet in the inventory
  const ironLeggings = bot.inventory.findInventoryItem(mcData.itemsByName.iron_leggings.id);
  const ironBoots = bot.inventory.findInventoryItem(mcData.itemsByName.iron_boots.id);
  const ironHelmet = bot.inventory.findInventoryItem(mcData.itemsByName.iron_helmet.id);

  // Equip the iron_leggings, iron_boots, and iron_helmet in the appropriate slots (legs, feet, and head)
  if (ironLeggings) {
    await bot.equip(ironLeggings, "legs");
    bot.chat("Equipped iron leggings.");
  } else {
    bot.chat("Iron leggings not found in inventory.");
  }
  if (ironBoots) {
    await bot.equip(ironBoots, "feet");
    bot.chat("Equipped iron boots.");
  } else {
    bot.chat("Iron boots not found in inventory.");
  }
  if (ironHelmet) {
    await bot.equip(ironHelmet, "head");
    bot.chat("Equipped iron helmet.");
  } else {
    bot.chat("Iron helmet not found in inventory.");
  }
}
```
