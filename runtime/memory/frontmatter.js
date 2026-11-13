// Markdown + YAML front matter (de)serialization.
import YAML from 'yaml'

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parse (text) {
  const m = text.match(FENCE)
  if (!m) return { data: {}, body: text }
  return { data: YAML.parse(m[1]) ?? {}, body: text.slice(m[0].length) }
}

export function stringify (data, body = '') {
  const yaml = YAML.stringify(data, { lineWidth: 0 }).trimEnd()
  return `---\n${yaml}\n---\n\n${body.trim()}\n`
}

export function slugify (s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled'
}
