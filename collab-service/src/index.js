require('dotenv').config()
const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const { Types } = require('mongoose')

const { connectDB } = require('./db')
const { loadSession, handleEdit, persistSession, flushAll, sessions } = require('./session-manager')

const PORT = process.env.PORT || 5001
const ALLOWED_ORIGIN = process.env.COLLAB_ORIGIN || '*'
const PERSIST_INTERVAL_MS = Number(process.env.PERSIST_INTERVAL_MS || 30000)

const roleOrder = { viewer: 1, commenter: 2, editor: 3, owner: 4 }

function hasRequiredRole(role, required) {
  return (roleOrder[role] || 0) >= (roleOrder[required] || 0)
}

async function main() {
  await connectDB()

  const app = express()
  app.use(cors())
  app.get('/health', (_req, res) => res.json({ status: 'ok', sessions: sessions.size }))

  const httpServer = http.createServer(app)
  const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('No auth token'))
    try {
      const secret = process.env.JWT_SECRET || 'dev-secret'
      const decoded = jwt.verify(token, secret)
      const userId = decoded.sub || decoded.userId || decoded.id
      if (!userId) return next(new Error('Invalid token payload'))
      socket.data.user = {
        id: userId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role || 'editor',
      }
      next()
    } catch (err) {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user

    socket.on('join_session', async ({ docId }) => {
      if (!docId) {
        socket.emit('error', { message: 'docId required' })
        return
      }
      if (!Types.ObjectId.isValid(docId)) {
        socket.emit('error', { message: 'Invalid docId format (expect 24-hex string)' })
        return
      }
      const session = await loadSession(docId)
      socket.join(roomFor(docId))
      socket.emit('session_joined', {
        docId,
        version: session.version,
        content: session.content,
        cursors: Array.from(session.cursors.entries()).map(([userId, cursor]) => ({ userId, cursor })),
      })
      socket.to(roomFor(docId)).emit('user_cursor', { userId: user.id, cursor: { pos: 0, selection: null } })
    })

    socket.on('edit_op', async ({ docId, baseVersion, ops }) => {
      if (!docId || !Array.isArray(ops)) return
      if (!Types.ObjectId.isValid(docId)) {
        socket.emit('error', { message: 'Invalid docId format (expect 24-hex string)' })
        return
      }
      if (!hasRequiredRole(user.role, 'editor')) {
        socket.emit('error', { message: 'Insufficient permission' })
        return
      }
      try {
        const { version, content, ops: rebasedOps } = await handleEdit({
          docId,
          userId: user.id,
          baseVersion: baseVersion ?? 0,
          ops,
        })
        const payload = { docId, version, ops: rebasedOps, content }
        io.to(roomFor(docId)).emit('broadcast_op', payload)
      } catch (err) {
        console.error('[collab] edit_op failed', err)
        socket.emit('error', { message: 'edit_op failed', detail: err.message })
      }
    })

    socket.on('cursor_update', async ({ docId, cursor }) => {
      if (!docId || !cursor) return
      if (!Types.ObjectId.isValid(docId)) return
      const session = await loadSession(docId)
      session.cursors.set(user.id, cursor)
      socket.to(roomFor(docId)).emit('user_cursor', { userId: user.id, cursor })
    })

    socket.on('disconnect', () => {
      // cursors will be cleared lazily in next join/persist
    })
  })

  setInterval(() => {
    flushAll().catch((err) => console.error('[collab] flush error', err))
  }, PERSIST_INTERVAL_MS)

  httpServer.listen(PORT, () => {
    console.log(`Collab service listening on http://localhost:${PORT}`)
  })
}

function roomFor(docId) {
  return `doc-${docId}`
}

main().catch((err) => {
  console.error('[collab] failed to start', err)
  process.exit(1)
})
