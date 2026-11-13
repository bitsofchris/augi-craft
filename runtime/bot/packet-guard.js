// Skip play packets the protocol library cannot parse instead of dropping
// the connection. On 26.3 the server sends some characters a 47 KB packet
// (id 0x85, item-stack NBT the parser rejects); without this guard the
// character can never log in again. The bot does not need those packets.

const varint = buf => {
  let id = 0; let shift = 0; let i = 0
  for (; i < 5 && i < buf.length; i++) {
    id |= (buf[i] & 0x7f) << shift
    if (!(buf[i] & 0x80)) break
    shift += 7
  }
  return id
}

/**
 * Patch every deserializer the client creates (one per protocol state).
 * @param {object} client node-minecraft-protocol client (bot._client)
 * @param {(msg: string) => void} [warn]
 * @returns {{ skipped: { id: number, size: number, state: string, message: string }[] }}
 */
export function installPacketGuard (client, warn = msg => console.error(msg)) {
  const report = { skipped: [] }
  const patch = () => {
    const d = client.deserializer
    if (!d || d.augiPacketGuard || typeof d.parsePacketBuffer !== 'function') return
    d.augiPacketGuard = true
    const parse = d.parsePacketBuffer.bind(d)
    d.parsePacketBuffer = buf => {
      try {
        return parse(buf)
      } catch (err) {
        // Only gameplay packets are safe to drop; a bad login packet must still fail.
        if (client.state !== 'play') throw err
        const entry = { id: varint(buf), size: buf.length, state: client.state, message: String(err.message).slice(0, 120) }
        report.skipped.push(entry)
        if (report.skipped.length <= 5) warn(`skipped unparseable packet 0x${entry.id.toString(16)} (${entry.size} bytes): ${entry.message}`)
        return { data: { name: 'augi_skipped_packet', params: {} }, metadata: { size: buf.length }, buffer: buf, fullBuffer: buf }
      }
    }
  }
  patch()
  client.on?.('state', () => patch())
  // The deserializer is replaced right after the state event in some versions.
  client.on?.('packet', patch)
  return report
}
