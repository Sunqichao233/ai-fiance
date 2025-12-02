const { applyOps, transformOps } = require('./ot')
const { Document, OperationLog } = require('./models')

const sessions = new Map()
const MAX_HISTORY = 200

async function loadSession(docId) {
  let session = sessions.get(docId)
  if (session) return session

  let doc = await Document.findById(docId)
  if (!doc) {
    doc = new Document({ _id: docId, title: 'Untitled Document', ownerId: 'system', currentVersion: 0, content: '' })
    await doc.save()
  }

  session = {
    docId,
    content: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content || ''),
    version: doc.currentVersion || 0,
    opHistory: [],
    cursors: new Map(),
    dirty: false,
    pendingLogs: [],
  }
  sessions.set(docId, session)
  return session
}

function recordHistory(session, version, ops) {
  session.opHistory.push({ version, ops })
  if (session.opHistory.length > MAX_HISTORY) {
    session.opHistory.shift()
  }
}

function transformFromVersion(session, fromVersion, ops) {
  const historyOps = session.opHistory
    .filter((item) => item.version > fromVersion)
    .flatMap((item) => item.ops)
  return transformOps(ops, historyOps)
}

async function handleEdit({ docId, userId, baseVersion, ops }) {
  const session = await loadSession(docId)
  const rebasedOps = transformFromVersion(session, baseVersion ?? session.version, ops)
  const newContent = applyOps(session.content, rebasedOps)
  const newVersion = (session.version || 0) + 1
  session.content = newContent
  session.version = newVersion
  recordHistory(session, newVersion, rebasedOps)
  session.dirty = true
  session.pendingLogs.push({
    documentId: docId,
    userId,
    action: 'edit_op',
    detail: `Applied ops at v${newVersion}`,
    versionNumber: newVersion,
    ops: rebasedOps,
  })
  return { session, version: newVersion, content: newContent, ops: rebasedOps }
}

async function persistSession(docId) {
  const session = sessions.get(docId)
  if (!session || !session.dirty) return
  const doc = await Document.findById(docId)
  if (doc) {
    doc.content = session.content
    doc.currentVersion = session.version
    await doc.save()
  }

  if (session.pendingLogs.length) {
    const logs = session.pendingLogs.map((log) => ({
      ...log,
      documentId: docId,
    }))
    await OperationLog.insertMany(logs)
    session.pendingLogs = []
  }

  session.dirty = false
}

async function flushAll() {
  const tasks = Array.from(sessions.keys()).map((docId) => persistSession(docId))
  await Promise.all(tasks)
}

module.exports = {
  loadSession,
  handleEdit,
  persistSession,
  flushAll,
  sessions,
}
