// The relay character: a Minecraft player that posts voice orders to chat and
// reports what others say. Reconnects on its own after a kick or restart.
import { EventEmitter } from 'node:events'

export function createRelay ({ connect, retryMs = 5000, log = () => {} }) {
  const relay = new EventEmitter()
  let bot = null
  let stopped = false

  async function start () {
    while (!stopped && !bot) {
      try {
        bot = await connect()
        log(`relay joined as ${bot.username}`)
        bot.on('chat', (username, message) => { if (username !== bot.username) relay.emit('chat', { username, message }) })
        bot.on('kicked', reason => log(`relay kicked: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`))
        bot.once('end', reason => {
          log(`relay disconnected (${reason}); reconnecting`)
          bot = null
          if (!stopped) setTimeout(start, retryMs)
        })
      } catch (err) {
        log(`relay could not join: ${err.message}; retrying in ${retryMs / 1000}s`)
        await new Promise(resolve => setTimeout(resolve, retryMs))
      }
    }
  }

  relay.start = start
  relay.stop = () => { stopped = true; bot?.end?.() }
  relay.online = name => Boolean(bot?.players?.[name])
  relay.say = line => {
    if (!bot) throw Object.assign(new Error('the relay is not in the game yet; is the server running?'), { status: 503 })
    if (line.trim().startsWith('/')) throw new Error('commands are not allowed')
    bot.chat(line)
  }
  return relay
}
