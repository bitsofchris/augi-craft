---
id: voyager-craft-shield-improved
title: craftShieldImproved
description: The function crafts a shield using oak planks and iron ingots. It checks if there are enough oak planks and iron ingots in the inventory, and if not, it explores the environment to find and collect the required materials. It then places a crafting table near the bot and crafts a shield using the crafting table.
kind: code-reference
level: 2
when:
  - The function crafts a shield using oak planks and iron ingots
prerequisites: []
depends_on:
  tools:
    - gather_blocks
    - craft_item
    - smelt_item
    - place_block
    - navigate_to
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/craftShieldImproved.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - mineBlock
  - craftItem
  - smeltItem
  - placeItem
  - exploreUntil
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - mineblock
  - craftitem
  - smeltitem
  - placeitem
  - exploreuntil
---

## Summary

The function crafts a shield using oak planks and iron ingots. It checks if there are enough oak planks and iron ingots in the inventory, and if not, it explores the environment to find and collect the required materials. It then places a crafting table near the bot and crafts a shield using the crafting table.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, craft_item, smelt_item, place_block, navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function craftShieldImproved(bot) {
  // Check if there are enough oak planks in the inventory
  let oakPlanksCount = bot.inventory.count(mcData.itemsByName.oak_planks.id);

  // If not, check if there are enough oak logs in the inventory
  if (oakPlanksCount < 6) {
    let oakLogsCount = bot.inventory.count(mcData.itemsByName.oak_log.id);
    const planksToCraft = Math.ceil((6 - oakPlanksCount) / 4);

    // If not, explore to find and mine oak logs
    if (oakLogsCount < planksToCraft) {
      await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
        const oak_log = bot.findBlock({
          matching: mcData.blocksByName["oak_log"].id,
          maxDistance: 32
        });
        return oak_log;
      });
      await mineBlock(bot, "oak_log", planksToCraft - oakLogsCount);
      bot.chat("Collected oak logs.");
    }

    // Craft oak planks from oak logs
    await craftItem(bot, "oak_planks", planksToCraft);
    bot.chat("Crafted oak planks.");
    oakPlanksCount = bot.inventory.count(mcData.itemsByName.oak_planks.id);
  }

  // Check if there are enough iron ingots in the inventory
  let ironIngotsCount = bot.inventory.count(mcData.itemsByName.iron_ingot.id);

  // If not, explore to find and mine iron ores
  if (ironIngotsCount < 1) {
    await exploreUntil(bot, new Vec3(0, -1, 0), 60, () => {
      const iron_ore = bot.findBlock({
        matching: mcData.blocksByName["iron_ore"].id,
        maxDistance: 32
      });
      return iron_ore;
    });
    await mineBlock(bot, "iron_ore", 1);
    bot.chat("Collected iron ores.");

    // Smelt iron ores into iron ingots
    await smeltItem(bot, "iron_ore", "coal", 1);
    bot.chat("Smelted iron ores into iron ingots.");
  }

  // Place the crafting table near the bot
  const craftingTablePosition = bot.entity.position.offset(1, 0, 0);
  await placeItem(bot, "crafting_table", craftingTablePosition);

  // Craft a shield using the crafting table
  await craftItem(bot, "shield", 1);
  bot.chat("Crafted a shield.");
}
```
