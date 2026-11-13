---
id: voyager-obtain-one-more-acacia-log
title: obtainOneMoreAcaciaLog
description: The function checks if there are less than 5 acacia logs in the inventory, and if so, finds and mines one more acacia log. If the bot successfully obtains 5 acacia logs, it sends a success message, otherwise it sends a failure message.
kind: code-reference
level: 2
when:
  - The function checks if there are less than 5 acacia logs in the inventory, and if so, finds and mines one more acacia log
prerequisites: []
depends_on:
  tools:
    - gather_blocks
    - navigate_to
  skills: []
implementation: "reference: Voyager JavaScript below calls Voyager primitives Augi lacks; adapt it into a program using lib actions"
status: unverified
source:
  origin: imported:voyager
  repo: https://github.com/MineDojo/Voyager
  path: skill_library/trial1/skill/code/obtainOneMoreAcaciaLog.js
  license: MIT (c) 2023 MineDojo Team
  version: 1
version: 1
voyager_primitives:
  - mineBlock
  - exploreUntil
evidence: []
failure_modes:
  - Written for Voyager's Minecraft 1.19 runtime and helper globals; untested on this server.
tags:
  - voyager
  - mineblock
  - exploreuntil
---

## Summary

The function checks if there are less than 5 acacia logs in the inventory, and if so, finds and mines one more acacia log. If the bot successfully obtains 5 acacia logs, it sends a success message, otherwise it sends a failure message.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function obtainOneMoreAcaciaLog(bot) {
  // Check the initial inventory for acacia logs
  const initialAcaciaLogs = bot.inventory.count(mcData.itemsByName.acacia_log.id);

  // If the number of acacia logs is less than 5, find and mine one more acacia log
  if (initialAcaciaLogs < 5) {
    const acaciaLog = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
      return bot.findBlock({
        matching: block => block.name === "acacia_log",
        maxDistance: 32
      });
    });
    if (!acaciaLog) {
      bot.chat("Could not find an acacia log.");
      return;
    }
    await mineBlock(bot, "acacia_log", 1);
    bot.chat("1 more acacia log obtained.");
  }

  // Check the final number of acacia logs in the inventory
  const finalAcaciaLogs = bot.inventory.count(mcData.itemsByName.acacia_log.id);
  if (finalAcaciaLogs >= 5) {
    bot.chat("Successfully obtained 5 acacia logs.");
  } else {
    bot.chat("Failed to obtain 5 acacia logs.");
  }
}
```
