const express = require('express')
const { Types } = require('mongoose')

const router = express.Router()

const {
  Document,
  DocumentVersion,
  Permission,
  OperationLog,
} = require('../models')
const {
  authenticate,
  getUserRoleForDocument,
  hasRequiredRole,
} = require('../auth')

function isValidObjectId(id) {
  return Types.ObjectId.isValid(id)
}

function serializeDocument(doc) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    content: doc.content,
    ownerId: doc.ownerId,
    currentVersion: doc.currentVersion,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function resolveDocument(req, res) {
  const { id } = req.params
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: 'Invalid document id' })
    return {}
  }

  const document = await Document.findById(id)
  if (!document) {
    res.status(404).json({ error: 'Document not found' })
    return {}
  }

  const role = await getUserRoleForDocument(req.user.id, document)
  if (!role) {
    res.status(403).json({ error: 'No permission for this document' })
    return {}
  }

  return { document, role }
}

router.use(authenticate)

router.get('/:id', async (req, res) => {
  const { document, role } = await resolveDocument(req, res)
  if (!document) return

  res.json({ document: serializeDocument(document), role })
})

router.get('/:id/versions', async (req, res) => {
  const { document, role } = await resolveDocument(req, res)
  if (!document) return
  if (!hasRequiredRole(role, 'viewer')) {
    return res.status(403).json({ error: 'Insufficient permission' })
  }

  const versions = await DocumentVersion.find({ documentId: document._id })
    .sort({ versionNumber: -1 })
    .lean()

  res.json({ role, versions })
})

router.post('/:id/save', async (req, res) => {
  const { id } = req.params
  const { content, title } = req.body || {}

  if (content === undefined) {
    return res.status(400).json({ error: 'Content is required' })
  }

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid document id' })
  }

  let document = await Document.findById(id)
  let role = null

  // Auto-create document if missing; creator becomes owner.
  if (!document) {
    document = new Document({
      _id: id,
      title: title || 'Untitled Document',
      content,
      ownerId: req.user.id,
      currentVersion: 0,
    })
    role = 'owner'
    await Permission.updateOne(
      { documentId: document._id, userId: req.user.id },
      { role: 'owner' },
      { upsert: true, setDefaultsOnInsert: true }
    )
  } else {
    role = await getUserRoleForDocument(req.user.id, document)
    if (!hasRequiredRole(role, 'editor')) {
      return res.status(403).json({ error: 'Insufficient permission' })
    }
  }

  document.title = title || document.title
  document.content = content
  document.currentVersion = (document.currentVersion || 0) + 1
  await document.save()

  await DocumentVersion.create({
    documentId: document._id,
    versionNumber: document.currentVersion,
    content,
    createdBy: req.user.id,
  })

  await OperationLog.create({
    documentId: document._id,
    userId: req.user.id,
    action: 'save',
    detail: `Saved version ${document.currentVersion}`,
    versionNumber: document.currentVersion,
  })

  res.json({
    message: 'Document saved',
    document: serializeDocument(document),
    role,
  })
})

router.post('/:id/revert', async (req, res) => {
  const { versionId } = req.body || {}
  if (!versionId) {
    return res.status(400).json({ error: 'versionId is required' })
  }

  const { document, role } = await resolveDocument(req, res)
  if (!document) return

  if (!hasRequiredRole(role, 'editor')) {
    return res.status(403).json({ error: 'Insufficient permission' })
  }

  const version = await DocumentVersion.findOne({
    _id: versionId,
    documentId: document._id,
  })
  if (!version) {
    return res.status(404).json({ error: 'Version not found for this document' })
  }

  document.content = version.content
  document.currentVersion = (document.currentVersion || 0) + 1
  await document.save()

  await DocumentVersion.create({
    documentId: document._id,
    versionNumber: document.currentVersion,
    content: version.content,
    createdBy: req.user.id,
  })

  await OperationLog.create({
    documentId: document._id,
    userId: req.user.id,
    action: 'revert',
    detail: `Reverted to version ${version.versionNumber}`,
    versionNumber: document.currentVersion,
  })

  res.json({
    message: 'Document reverted',
    document: serializeDocument(document),
    revertedFromVersion: version.versionNumber,
  })
})

module.exports = router
