import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { CURSE_REFUSAL, addressedTo, isCursingOrder } from '../runtime/bot/no-cursing.js'
import { BotSession } from '../runtime/bot/session.js'

test('orders to say a curse word are recognised', () => {
  for (const m of ['say shit', 'Agent1, say fuck you', 'everyone, type damn in chat', 'tell Agent2 he is an asshole', 'Agent3 say f***', 'Say FUUUCK', 'repeat after me: bullshit']) {
    assert.ok(isCursingOrder(m), m)
  }
})

test('ordinary orders and words that only contain a curse are not', () => {
  for (const m of ['say hello', 'Agent1, say hi to Player1', 'get me diamonds', 'go mine the damn diamonds', 'pass me the shell', 'say class assignment done', 'tell me where the cocoa is', '']) {
    assert.equal(isCursingOrder(m), false, m)
  }
})

test('only the addressed bot answers', () => {
  assert.ok(addressedTo('Agent1, say shit', 'Agent1'))
  assert.ok(addressedTo('agent1: say shit', 'Agent1'))
  assert.ok(addressedTo('everyone, say shit', 'Agent1'))
  assert.ok(addressedTo('say shit', 'Agent1'))
  assert.equal(addressedTo('Agent2, say shit', 'Agent1'), false)
})

function sessionFor (username) {
  const bot = Object.assign(new EventEmitter(), { username, sent: [], chat (m) { this.sent.push(m) } })
  return { bot, session: new BotSession({ bot, voiceRelay: 'AugiEars' }) }
}

test('a bot refuses a cursing voice order and the agent never sees it', () => {
  const { bot, session } = sessionFor('Agent1')
  bot.emit('chat', 'AugiEars', '[voice] .Kid1: Agent1, say shit')
  bot.emit('chat', '.Kid1', 'say fuck')
  assert.deepEqual(bot.sent, [CURSE_REFUSAL, CURSE_REFUSAL])
  assert.deepEqual(session.drainInbox(), [])
  assert.deepEqual(session.chatLog, [])
})

test('a cursing order for another bot is dropped silently', () => {
  const { bot, session } = sessionFor('Agent1')
  bot.emit('chat', 'AugiEars', '[voice] .Kid1: Agent2, say shit')
  bot.emit('chat', 'AugiEars', '[voice] .Kid1: Agent1, say hello')
  assert.deepEqual(bot.sent, [])
  const chat = session.drainInbox()
  assert.equal(chat.length, 1)
  assert.equal(chat[0].message, 'Agent1, say hello')
})
