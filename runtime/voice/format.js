// The relay character posts voice orders as `[voice] <player>: <text>`.
// Workers' BotSession turns those lines back into chat from <player>.

export const DEFAULT_RELAY = 'AugiEars'
export const MAX_TEXT = 200 // Minecraft chat allows 256 characters per line

const LINE = /^\[voice\] (\S+): (.+)$/

/** Build the chat line for an order; `target` is a bot name or 'everyone'. */
export function formatVoiceChat (player, text, target = null) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  const body = target ? `${target}, ${clean}` : clean
  return `[voice] ${player}: ${body}`.slice(0, MAX_TEXT + player.length + 10)
}

/** The player and message of a relayed line, or null for ordinary chat. */
export function parseVoiceChat (username, message, relay = DEFAULT_RELAY) {
  if (!relay || username?.toLowerCase() !== relay.toLowerCase()) return null
  const m = LINE.exec(String(message ?? ''))
  return m ? { username: m[1], message: m[2] } : null
}
