const names = ['peaceful', 'easy', 'normal', 'hard']

export function normalizeDifficulty (value) {
  return typeof value === 'string' && names.includes(value) ? value : Number.isInteger(value) ? names[value] ?? null : null
}

// 26.3's protocol mapper already decodes difficulty to its name; upstream
// Mineflayer indexes that name as a number and loses the server's actual value.
export function installDifficultyCompatibility (bot) {
  if (bot._augiDifficultyCompatibility) return
  bot._augiDifficultyCompatibility = true
  bot._client.on('difficulty', packet => {
    const difficulty = normalizeDifficulty(packet.difficulty)
    if (difficulty === null) return
    // Run after all upstream packet listeners, regardless of plugin load order.
    queueMicrotask(() => { bot.game.difficulty = difficulty })
  })
}
