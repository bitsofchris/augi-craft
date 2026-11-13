// One port for both schemes: phones often open "192.168.1.x:8443" as plain
// http, which an https-only server drops ("no connection"). Peek at the first
// byte of each connection: TLS handshakes start with 0x16, so those go to the
// https server and everything else gets a redirect to the https address.
import net from 'node:net'
import http from 'node:http'

export function redirectToHttps (req, res) {
  res.writeHead(301, { location: `https://${req.headers.host ?? 'localhost'}${req.url}` })
  res.end()
}

/**
 * @param {import('node:https').Server} secure
 * @param {(address: string) => void} [onClient] called once per new client address
 */
export function dualSchemeServer (secure, { plain = http.createServer(redirectToHttps), onClient = () => {} } = {}) {
  const seen = new Set()
  return net.createServer(socket => {
    const address = socket.remoteAddress?.replace(/^::ffff:/, '') ?? 'unknown'
    if (!seen.has(address)) { seen.add(address); onClient(address) }
    socket.once('data', first => {
      socket.pause()
      socket.unshift(first)
      ;(first[0] === 0x16 ? secure : plain).emit('connection', socket)
      process.nextTick(() => socket.resume())
    })
    socket.on('error', () => {})
  })
}
