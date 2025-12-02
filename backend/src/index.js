const express = require('express')
const cors = require('cors')

const PORT = process.env.PORT || 4000

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
