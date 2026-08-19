// SoNovel — auth (email/password, mirror §5.1)
// Lightweight: profile table holds passwordHash (scrypt).
// Session = httpOnly cookie 'sonovel_sid' → sessionId in SessionStore table-less (signed JWT-like token).

import crypto from 'crypto'

const SESSION_COOKIE = 'sonovel_sid'
const SESSION_SECRET = process.env.SONOVEL_SESSION_SECRET || 'sonovel-dev-secret-change-me'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// ---- password hashing (scrypt) ----
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'))
}

// ---- session token (signed) ----
type SessionPayload = { uid: string; email: string; role: string; iat: number; exp: number }

export function signSession(uid: string, email: string, role: string): string {
  const payload: SessionPayload = {
    uid,
    email,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(token: string | null | undefined): SessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE
