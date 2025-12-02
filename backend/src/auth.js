const jwt = require('jsonwebtoken')
const { Permission, User } = require('./models')

const roleOrder = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  owner: 4,
}

function hasRequiredRole(userRole, requiredRole) {
  if (!userRole) return false
  return (roleOrder[userRole] || 0) >= (roleOrder[requiredRole] || 0)
}

function getTokenFromHeader(authHeader) {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (!/^Bearer$/i.test(scheme)) return null
  return token
}

async function ensureUser(userPayload) {
  if (!userPayload?.id) return null
  const update = {
    email: userPayload.email,
    name: userPayload.name,
  }
  await User.findByIdAndUpdate(userPayload.id, update, { upsert: true, new: true, setDefaultsOnInsert: true })
  return { id: userPayload.id, email: userPayload.email, name: userPayload.name }
}

async function authenticate(req, res, next) {
  const token = getTokenFromHeader(req.headers.authorization)
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  try {
    const secret = process.env.JWT_SECRET || 'dev-secret'
    const decoded = jwt.verify(token, secret)
    const userId = decoded.sub || decoded.userId || decoded.id
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' })
    }
    const user = await ensureUser({ id: userId, email: decoded.email, name: decoded.name })
    req.user = user
    next()
  } catch (err) {
    console.error('[auth] token verification failed', err.message)
    res.status(401).json({ error: 'Unauthorized' })
  }
}

async function getUserRoleForDocument(userId, document) {
  if (!document || !userId) return null
  if (document.ownerId === userId) return 'owner'
  const perm = await Permission.findOne({ documentId: document._id, userId }).lean()
  return perm?.role || null
}

module.exports = {
  authenticate,
  getUserRoleForDocument,
  hasRequiredRole,
  roleOrder,
}
