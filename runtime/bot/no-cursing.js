// A hard rule the agents cannot reason around: an order to say a curse word
// never reaches the agent. The bot answers with a fixed refusal instead.
// Matches typed chat and voice orders (Whisper sometimes masks words as f***).

export const CURSE_REFUSAL = "Sorry, cursing is bad. I won't do it. I don't want to get in trouble and not get to play Minecraft anymore!"

const SPEAK = /\b(say|says|said|saying|type|write|tell|repeat|chat|yell|shout|scream|spell)\b/i
const CURSES = [
  'fuck\\w*', 'motherfuck\\w*', 'f+u+c+k+\\w*', 'shit\\w*', 'bullshit', 'bitch\\w*', 'bastards?',
  'damn\\w*', 'goddamn\\w*', 'hell', 'crap\\w*', 'piss\\w*', 'cunts?', 'dicks?', 'cocks?',
  'ass', 'asses', 'asshole\\w*', 'jackass\\w*', 'dumbass\\w*', 'badass\\w*', 'wtf', 'stfu'
]
const CURSE = new RegExp(`\\b(${CURSES.join('|')})\\b`, 'i')
const MASKED = /\b[a-z]\*{2,}/i // "f***", "s***" as speech-to-text writes them
const ADDRESS = /^\s*([A-Za-z0-9_.]+)\s*[,:]/

/** True when the message asks someone to say a curse word. */
export function isCursingOrder (message) {
  const text = String(message ?? '')
  const verb = SPEAK.exec(text)
  if (!verb) return false
  const rest = text.slice(verb.index + verb[0].length)
  return CURSE.test(rest) || MASKED.test(rest)
}

/** True unless the message starts by naming a different player or bot ("Agent2, ..."). */
export function addressedTo (message, username) {
  const m = ADDRESS.exec(String(message ?? ''))
  if (!m) return true
  const name = m[1].toLowerCase()
  return name === String(username ?? '').toLowerCase() || name === 'everyone' || name === 'all'
}
