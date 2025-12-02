function applyOps(content, ops) {
  let result = content || ''
  for (const op of ops) {
    if (op.type === 'replace') {
      result = op.text ?? ''
      continue
    }
    if (op.type === 'insert') {
      const before = result.slice(0, op.pos)
      const after = result.slice(op.pos)
      result = before + (op.text ?? '') + after
    } else if (op.type === 'delete') {
      const before = result.slice(0, op.pos)
      const after = result.slice(op.pos + (op.length || 0))
      result = before + after
    }
  }
  return result
}

function transformOpAgainst(op, other) {
  const newOp = { ...op }
  if (other.type === 'replace') {
    return newOp
  }

  if (newOp.type === 'replace') {
    return newOp
  }

  if (newOp.type === 'insert') {
    if (other.type === 'insert') {
      if (other.pos < newOp.pos || (other.pos === newOp.pos && other.clientId !== newOp.clientId)) {
        newOp.pos += (other.text || '').length
      }
    } else if (other.type === 'delete') {
      if (other.pos < newOp.pos) {
        const delta = Math.min(other.length || 0, newOp.pos - other.pos)
        newOp.pos -= delta
      }
    }
  } else if (newOp.type === 'delete') {
    if (other.type === 'insert') {
      if (other.pos <= newOp.pos) {
        newOp.pos += (other.text || '').length
      }
    } else if (other.type === 'delete') {
      if (other.pos < newOp.pos) {
        const delta = Math.min(other.length || 0, newOp.pos - other.pos)
        newOp.pos -= delta
      }
      if (other.pos <= newOp.pos && other.pos + (other.length || 0) >= newOp.pos) {
        const overlap = other.pos + (other.length || 0) - newOp.pos
        newOp.length = Math.max(0, (newOp.length || 0) - overlap)
      }
    }
  }

  return newOp
}

function transformOps(ops, historyOps) {
  return ops.map((op) => historyOps.reduce((current, hist) => transformOpAgainst(current, hist), op))
}

module.exports = { applyOps, transformOps }
