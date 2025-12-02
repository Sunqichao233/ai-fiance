const { Schema, model } = require('mongoose')

const DocumentSchema = new Schema(
  {
    title: { type: String, default: 'Untitled Document' },
    content: { type: Schema.Types.Mixed, default: '' },
    ownerId: { type: String, required: true, default: 'system' },
    currentVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const OperationLogSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    userId: { type: String, required: true },
    action: { type: String, required: true },
    detail: String,
    versionNumber: Number,
    ops: { type: Array, default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

const Document = model('Document', DocumentSchema)
const OperationLog = model('OperationLog', OperationLogSchema)

module.exports = { Document, OperationLog }
