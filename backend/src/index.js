require('dotenv').config()
const express = require('express')
const cors = require('cors')

const { connectDB } = require('./db')
const documentsRouter = require('./routes/documents')

const PORT = process.env.PORT || 4000

async function start() {
  await connectDB()

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  app.use('/documents', documentsRouter)

  // Fallback error handler
  app.use((err, _req, res, _next) => {
    console.error('[server] unhandled error', err)
    res.status(500).json({ error: 'Internal server error' })
  })

  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`)
  })
}

start().catch((err) => {
  console.error('[server] failed to start', err)
  process.exit(1)
})
