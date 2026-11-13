// Who is a crew bot and who is a person playing. Bot names come from the
// instance's crew.json ($AUGI_HOME/crew.json, else the example crew), so
// renamed bots are never mistaken for players; old Augi* characters count as
// bots too.
import { homePaths, loadCrew } from '../home.js'

/** Lower-cased bot usernames listed in a crew file; empty if it cannot be read. */
export function loadCrewNames (file = homePaths().crewFile) {
  const crew = loadCrew(file)
  return new Set([...(crew.workers ?? []).map(w => w.username), crew.voice?.relay].filter(Boolean).map(n => n.toLowerCase()))
}

let crewNames = null

/** True for a crew bot's username. */
export function isBotName (name, names = (crewNames ??= loadCrewNames())) {
  if (!name) return false
  return /^augi/i.test(name) || names.has(name.toLowerCase())
}

/** Online players who are people, not crew bots (and not this bot). */
export function humanPlayers (bot, names) {
  return Object.values(bot.players ?? {})
    .filter(p => p.username && p.username !== bot.username && !isBotName(p.username, names))
    .map(p => p.username)
}

/** True when any person is on the server, anywhere. */
export const humansOnline = (bot, names) => humanPlayers(bot, names).length > 0
