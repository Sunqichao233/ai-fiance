const { Schema, model } = require('mongoose')

const roleEnum = ['owner', 'editor', 'commenter', 'viewer']

const UserSchema = new Schema(
  {
    _id: { type: String, required: true }, // use auth provider user id as primary key
    email: String,
    name: String,
  },
  { _id: false, timestamps: true }
)

const DocumentSchema = new Schema(
  {
    title: { type: String, default: 'Untitled Document' },
    content: { type: Schema.Types.Mixed, default: {} },
    ownerId: { type: String, required: true, ref: 'User' },
    currentVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const DocumentVersionSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    versionNumber: { type: Number, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: String, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)
DocumentVersionSchema.index({ documentId: 1, versionNumber: -1 }, { unique: true })

const PermissionSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    userId: { type: String, ref: 'User', required: true },
    role: { type: String, enum: roleEnum, required: true },
  },
  { timestamps: true }
)
PermissionSchema.index({ documentId: 1, userId: 1 }, { unique: true })

const OperationLogSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    userId: { type: String, ref: 'User', required: true },
    action: { type: String, required: true },
    detail: String,
    versionNumber: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

const User = model('User', UserSchema)
const Document = model('Document', DocumentSchema)
const DocumentVersion = model('DocumentVersion', DocumentVersionSchema)
const Permission = model('Permission', PermissionSchema)
const OperationLog = model('OperationLog', OperationLogSchema)

module.exports = {
  User,
  Document,
  DocumentVersion,
  Permission,
  OperationLog,
  roleEnum,
}
