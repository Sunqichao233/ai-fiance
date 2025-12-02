import { io, Socket } from 'socket.io-client'

export type Role = 'owner' | 'editor' | 'commenter' | 'viewer'

export type Operation =
  | { type: 'replace'; text: string; pos?: number; clientId?: string }
  | { type: 'insert'; pos: number; text: string; clientId?: string }
  | { type: 'delete'; pos: number; length: number; clientId?: string }

export type BroadcastPayload = {
  docId: string
  version: number
  ops: Operation[]
  content: string
}

export function applyOps(content: string, ops: Operation[]) {
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

export function createSocket(token: string | null) {
  const url = import.meta.env.VITE_COLLAB_URL || 'http://localhost:5001'
  const socket: Socket = io(url, {
    transports: ['websocket'],
    auth: { token: token || 'dev-token' },
  })
  return socket
}
