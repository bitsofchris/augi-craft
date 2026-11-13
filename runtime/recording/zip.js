// Minimal ZIP writer (deflate, no ZIP64) for replay files, on Node's zlib.
import fs from 'node:fs'
import zlib from 'node:zlib'

const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b }

/**
 * Build a ZIP archive in memory.
 * @param {{ name: string, data: Buffer }[]} entries
 * @returns {Buffer}
 */
export function buildZip (entries) {
  const parts = []
  const central = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = zlib.crc32(data)
    const deflated = zlib.deflateRawSync(data)
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(0), u16(0x21),
      u32(crc), u32(deflated.length), u32(data.length), u16(nameBuf.length), u16(0), nameBuf
    ])
    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(0), u16(0x21),
      u32(crc), u32(deflated.length), u32(data.length), u16(nameBuf.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBuf
    ]))
    parts.push(local, deflated)
    offset += local.length + deflated.length
  }
  const dir = Buffer.concat(central)
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(dir.length), u32(offset), u16(0)])
  return Buffer.concat([...parts, dir, end])
}

export function writeZip (file, entries) {
  fs.writeFileSync(file, buildZip(entries))
}

/** Read a ZIP built by buildZip (tests and tools): name -> Buffer. */
export function readZip (buf) {
  const out = {}
  const endAt = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  let p = buf.readUInt32LE(endAt + 16)
  const count = buf.readUInt16LE(endAt + 10)
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localAt = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const dataAt = localAt + 30 + buf.readUInt16LE(localAt + 26) + buf.readUInt16LE(localAt + 28)
    const raw = buf.subarray(dataAt, dataAt + size)
    out[name] = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw)
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}
