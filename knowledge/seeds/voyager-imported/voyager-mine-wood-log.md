---
id: voyager-mine-wood-log
title: mineWoodLog
description: The function is about mining a single wood log block. It searches for a wood log block by exploring the environment until it finds one of the seven types of wood logs. If a wood log block is found, it is mined and a success message is sent. If no wood log block is found, a failure message is sent.
kind: code-reference
level: 2
when:
  - The function is about mining a single wood log block
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
  path: skill_library/trial1/skill/code/mineWoodLog.js
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

The function is about mining a single wood log block. It searches for a wood log block by exploring the environment until it finds one of the seven types of wood logs. If a wood log block is found, it is mined and a success message is sent. If no wood log block is found, a failure message is sent.

## How to use in Augi

The code calls Voyager's control primitives (mineBlock, craftItem, ...), which are not in scope here. Adapt the strategy into a program that uses lib actions (gather_blocks, navigate_to), test it, and save it with save_helper.

## Reference code (Voyager, MIT)

```javascript
async function mineWoodLog(bot) {
  const woodLogNames = ["oak_log", "birch_log", "spruce_log", "jungle_log", "acacia_log", "dark_oak_log", "mangrove_log"];

  // Find a wood log block
  const woodLogBlock = await exploreUntil(bot, new Vec3(1, 0, 1), 60, () => {
    return bot.findBlock({
      matching: block => woodLogNames.includes(block.name),
      maxDistance: 32
    });
  });
  if (!woodLogBlock) {
    bot.chat("Could not find a wood log.");
    return;
  }

  // Mine the wood log block
  await mineBlock(bot, woodLogBlock.name, 1);
  bot.chat("Wood log mined.");
}
```
