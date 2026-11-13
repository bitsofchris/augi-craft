// Creates a Mineflayer bot with the plugins the lib actions and programs rely on.
import mineflayer from 'mineflayer'
import { installDifficultyCompatibility } from './difficulty-compat.js'
import { installPacketGuard } from './packet-guard.js'
import { recordBot, ReplayRecorder } from '../recording/replay-recorder.js'
import { homePaths } from '../home.js'
import pathfinderPkg from 'mineflayer-pathfinder'
import { plugin as collectBlock } from 'mineflayer-collectblock'
import { plugin as tool } from 'mineflayer-tool'
import { install26_3WindowStateFix } from './inventory-compat.js'
import { installOpenDoorNavigation, installDoorPathNormalization } from './door-navigation.js'

const { pathfinder, Movements } = pathfinderPkg

/** Wait until nearby terrain is available before exposing the bot to tools. */
export async function waitForNearbyChunks (bot) {
  await bot.waitForChunksToLoad?.()
}

export function install26_3CollisionDimensions (bot) {
  if (bot.version !== '26.3') return
  // EntityDimensions stores floats in Java, rather than exact JS decimals.
  bot.physics.playerHalfWidth = Math.fround(0.6) / 2
  bot.physics.playerHeight = Math.fround(1.8)
}

/** Minecraft 26.3 inserted an action at ID 1; Mineflayer's pending fix is #4146. */
export function install26_3PlayerActionFix (bot, version = bot.version) {
  if (version !== '26.3' || bot._augiPlayerActionFix) return
  bot._augiPlayerActionFix = true
  const client = bot._client
  const write = client.write
  client.write = function (name, params, ...rest) {
    // All pre-26.3 actions after START shifted, including bow release (5→6),
    // item drops and off-hand swaps. Verified against the local server enum.
    if (name === 'block_dig' && Number.isInteger(params.status) && params.status >= 1 && params.status <= 7) {
      params = { ...params, status: params.status + 1 }
    }
    return write.call(this, name, params, ...rest)
  }
}

/** Keep an iron pickaxe available for ore that a stone pickaxe cannot harvest. */
export function installResourceAwarePathfinder (bot) {
  if (bot._augiResourceAwarePathfinder) return
  bot._augiResourceAwarePathfinder = true
  // Long trips (up a mine staircase) need more planning time than the 5 s default.
  bot.pathfinder.thinkTimeout = 20_000
  const fastest = bot.pathfinder.bestHarvestTool
  bot.pathfinder.bestHarvestTool = function (block) {
    // Dig ordinary dirt, gravel and similar blocks by hand, preserving tools.
    if (!block.harvestTools || Object.keys(block.harvestTools).length === 0) return null
    const items = bot.inventory.items()
    for (const name of ['stone_pickaxe', 'wooden_pickaxe']) {
      const tool = items.find(item => item.name === name && block.canHarvest?.(item.type))
      if (tool) return tool
    }
    return fastest.call(this, block)
  }
}

export function connectionOptionsFromEnv (env = process.env) {
  return {
    host: env.MC_HOST ?? '127.0.0.1',
    port: Number(env.MC_PORT ?? 25565),
    username: env.MC_USERNAME ?? 'Augi',
    // 'offline' works for LAN worlds and servers with online-mode=false.
    // Use 'microsoft' to join online-mode servers with a real account.
    auth: env.MC_AUTH ?? 'offline',
    // Leave unset to auto-detect the server version.
    version: env.MC_VERSION || false
  }
}

/**
 * AUGI_RECORD=1 saves every connection as a ReplayMod replay in
 * AUGI_RECORD_DIR (default $AUGI_HOME/recordings); see docs/RECORDING.md.
 */
export function recordingDirFromEnv (env = process.env) {
  if (!/^(1|true|on|yes)$/i.test(env.AUGI_RECORD ?? '')) return null
  return homePaths(env).recordingsDir
}

/**
 * Connect and resolve once the bot has spawned.
 * @param {object} [options] mineflayer createBot options
 * @param {number} [spawnTimeoutMs]
 */
export function connectBot (options = connectionOptionsFromEnv(), spawnTimeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const bot = mineflayer.createBot({ ...options, hideErrors: true })
    installPacketGuard(bot._client)
    const recordDir = recordingDirFromEnv()
    if (recordDir) recordBot(bot, new ReplayRecorder({ dir: recordDir, name: options.username, version: options.version, serverName: `${options.host}:${options.port}` }))
    installDifficultyCompatibility(bot)
    install26_3PlayerActionFix(bot, options.version)
    bot.loadPlugin(pathfinder)
    bot.loadPlugin(tool)
    bot.loadPlugin(collectBlock)

    const timer = setTimeout(() => {
      cleanup()
      bot.end?.()
      reject(new Error(`Timed out waiting to spawn on ${options.host}:${options.port}`))
    }, spawnTimeoutMs)
    const onError = err => { cleanup(); reject(err) }
    const onKicked = reason => { cleanup(); reject(new Error(`Kicked: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`)) }
    const onSpawn = async () => {
      try {
        install26_3PlayerActionFix(bot)
        install26_3WindowStateFix(bot)
        // Java's entity dimensions are floats. Exact decimal dimensions let
        // the simulated player overlap a stair edge by ~1e-8 blocks, causing
        // the server to reject otherwise valid jumps as new collisions.
        install26_3CollisionDimensions(bot)
        await waitForNearbyChunks(bot)
        cleanup()
        const movements = installOpenDoorNavigation(new Movements(bot))
        movements.allowParkour = false // fewer surprising falls
        bot.pathfinder.setMovements(movements)
        installDoorPathNormalization(bot)
        installResourceAwarePathfinder(bot)
        resolve(bot)
      } catch (err) {
        cleanup()
        bot.end?.()
        reject(err)
      }
    }
    function cleanup () {
      clearTimeout(timer)
      bot.removeListener('error', onError)
      bot.removeListener('kicked', onKicked)
      bot.removeListener('spawn', onSpawn)
    }
    bot.once('error', onError)
    bot.once('kicked', onKicked)
    bot.once('spawn', onSpawn)
    // Keep long-lived bots from crashing the MCP process on later errors.
    bot.on('error', err => console.error('[augi] bot error:', err.message))
  })
}
