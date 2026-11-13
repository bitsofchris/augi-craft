---
id: voyager-mine-three-more-oak-logs
title: mineThreeMoreOakLogs
description: The function is about mining 3 oak logs. It first checks the initial inventory for oak logs. Then, it explores the environment until it finds 3 oak log blocks. If it cannot find enough oak logs, it returns. Otherwise, it mines the oak log blocks and compares the final inventory with the initial inventory to determine if it successfully mined 3 more oak logs.
kind: code-reference
level: 2
when:
  - The function is about mining 3 oak logs
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
  path: skill_library/trial1/skill/code/mineThreeMoreOakLogs.js
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

The function is about mining 3 oak logs. It first checks the initial inventory for oak logs. Then, it explores the environment until it finds 3 oak log blocks. If it cannot find enough oak logs, it returns. Otherwise, it mines the oak log blocks and compares the final inventory with the initial inventory to determine if it successfully mined 3 more oak logs.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function mineThreeMoreOakLogs(bot) {
  // Check the initial inventory for oak logs
  const initialOakLogs = bot.inventory.count(mcData.itemsByName.oak_log.id);

  // Find 3 oak_log blocks
  const oakLogs = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    const oakLogs = bot.findBlocks({
      matching: block => block.name === "oak_log",
      maxDistance: 32,
      count: 3
    });
    return oakLogs.length >= 3 ? oakLogs : null;
  });
  if (!oakLogs) {
    bot.chat("Could not find enough oak logs.");
    return;
  }

  // Mine the oak_log blocks
  await mineBlock(bot, "oak_log", 3);
  bot.chat("3 oak logs mined.");

  // Compare the final inventory with the initial inventory
  const finalOakLogs = bot.inventory.count(mcData.itemsByName.oak_log.id);
  if (finalOakLogs - initialOakLogs === 3) {
    bot.chat("Successfully mined 3 more oak logs.");
  } else {
    bot.chat("Failed to mine 3 more oak logs.");
  }
}
```
