const mongoose = require('mongoose')

const defaultUri = 'mongodb://admin:example@localhost:27017/?authSource=admin'

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || defaultUri
  const dbName = process.env.MONGODB_DB || 'ai-financial'
  await mongoose.connect(mongoUri, { dbName })
  console.log(`[mongo] connected to ${mongoUri} (db: ${dbName})`)
}

module.exports = { connectDB }
