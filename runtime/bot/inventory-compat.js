/** Keep 26.3 menu revisions separate from unrelated player inventory updates. */
export function install26_3WindowStateFix (bot) {
  if (bot.version !== '26.3' || bot._augiWindowStateFix) return
  bot._augiWindowStateFix = true
  const client = bot._client
  const revisions = new Map()
  const update = packet => {
    if (packet.windowId >= 0 && Number.isInteger(packet.stateId)) revisions.set(packet.windowId, packet.stateId)
  }
  client.on('window_items', update)
  client.on('set_slot', update)
  client.on('open_window', packet => revisions.delete(packet.windowId))
  client.on('respawn', () => revisions.clear())
  client.on('login', () => revisions.clear())
  const write = client.write
  client.write = function (name, params, ...rest) {
    // -1 is the upstream explicit full-state synchronization request.
    if (name === 'window_click' && params.stateId !== -1 && revisions.has(params.windowId)) {
      params = { ...params, stateId: revisions.get(params.windowId) }
    }
    return write.call(this, name, params, ...rest)
  }
}
