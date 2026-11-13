// Shrink tool results before they reach the model. Every result stays in the
// agent's context and is re-read on every later model call, so empty fields,
// unchanged positions and pretty-printing cost tokens many times over.

const isEmpty = v => v == null || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

const samePos = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z

/** Drop empty values recursively; report position changes only when the bot moved. */
export function compactResult (value) {
  if (Array.isArray(value)) return value.map(compactResult).filter(v => !isEmpty(v))
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [key, raw] of Object.entries(value)) {
    let v = raw
    if (key === 'changes' && v && typeof v === 'object') {
      v = { ...v }
      if (samePos(v.position?.from, v.position?.to)) delete v.position
    }
    if (key === 'at' && typeof v === 'string') v = v.slice(11, 19) // HH:MM:SS is enough in chat events
    v = compactResult(v)
    if (!isEmpty(v)) out[key] = v
  }
  return out
}

/** One line of JSON, no indentation. */
export function formatResult (result) {
  return JSON.stringify(compactResult(result))
}
