import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, query, withTransaction, type UserRow } from './db.js'
import { HttpError } from './http.js'

const ACCESS_TTL = '15m'
const REFRESH_DAYS = 30

export type GoogleProfile = {
  sub: string
  email: string
  name: string
  picture: string | null
}

let google: OAuth2Client | null = null

function secret(): string {
  const value = process.env.JWT_SECRET ?? ''
  if (value.length < 16) throw new HttpError(503, 'Sign-in is not configured yet.')
  return value
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function expiry(): string {
  return new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

const scryptAsync = promisify(scrypt)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const hash = await scryptAsync(password, salt, 32) as Buffer
  return `scrypt$${salt}$${hash.toString('base64url')}`
}

export async function checkPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const [kind, salt, hash] = stored.split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const next = await scryptAsync(password, salt, 32) as Buffer
  const have = Buffer.from(hash, 'base64url')
  if (have.length !== next.length) return false
  return timingSafeEqual(have, next)
}

export async function registerAccount(name: string, email: string, password: string): Promise<UserRow> {
  const existing = await query<UserRow[]>('SELECT id FROM users WHERE email = ?', [email])
  if (existing[0]) throw new HttpError(409, 'An account with that email already exists. Sign in.')
  const id = randomUUID()
  try {
    await execute(
      'INSERT INTO users (id, google_sub, email, name, picture, password_hash) VALUES (?, NULL, ?, ?, NULL, ?)',
      [id, email, name, await hashPassword(password)],
    )
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
    if (code === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account with that email already exists. Sign in.')
    throw error
  }
  return { id, google_sub: null, email, name, picture: null } as UserRow
}

export async function loginAccount(email: string, password: string): Promise<UserRow> {
  const rows = await query<UserRow[]>('SELECT id, google_sub, email, name, picture, password_hash FROM users WHERE email = ?', [email])
  const user = rows[0]
  if (!user || !(await checkPassword(password, user.password_hash))) {
    throw new HttpError(401, 'That email or password is not right.')
  }
  return user
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  if (next.length < 8 || next.length > 200) throw new HttpError(400, 'Use a password of at least 8 characters.')
  const rows = await query<UserRow[]>('SELECT password_hash FROM users WHERE id = ?', [userId])
  const stored = rows[0]?.password_hash
  if (!stored) throw new HttpError(400, 'This account signs in with Google.')
  if (!(await checkPassword(current, stored))) throw new HttpError(401, 'That password is not right.')
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(next), userId])
}

export async function verifyGoogle(credential: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
  if (!clientId) throw new HttpError(503, 'Google sign-in is not configured yet.')
  if (!google) google = new OAuth2Client(clientId)
  let payload: { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string } | undefined
  try {
    const ticket = await google.verifyIdToken({ idToken: credential, audience: clientId })
    payload = ticket.getPayload()
  } catch {
    throw new HttpError(401, 'Google did not confirm this account.')
  }
  if (!payload?.sub || !payload.email || payload.email_verified === false) {
    throw new HttpError(401, 'Google did not confirm this account.')
  }
  const picture = typeof payload.picture === 'string' && payload.picture.startsWith('https://') && payload.picture.length <= 512
    ? payload.picture
    : null
  return {
    sub: payload.sub,
    email: payload.email.slice(0, 255),
    name: (payload.name || payload.email).slice(0, 255),
    picture,
  }
}

export async function upsertUser(profile: GoogleProfile): Promise<UserRow> {
  const existing = await query<UserRow[]>('SELECT id, google_sub, email, name, picture FROM users WHERE google_sub = ?', [profile.sub])
  if (existing[0]) {
    await execute('UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?', [profile.email, profile.name, profile.picture, existing[0].id])
    return { ...existing[0], email: profile.email, name: profile.name, picture: profile.picture }
  }
  const byEmail = await query<UserRow[]>('SELECT id, google_sub, email, name, picture FROM users WHERE email = ?', [profile.email])
  if (byEmail[0] && !byEmail[0].google_sub) {
    await execute('UPDATE users SET google_sub = ?, name = ?, picture = ? WHERE id = ?', [profile.sub, profile.name, profile.picture, byEmail[0].id])
    return { ...byEmail[0], google_sub: profile.sub, name: profile.name, picture: profile.picture }
  }
  const id = randomUUID()
  try {
    await execute(
      'INSERT INTO users (id, google_sub, email, name, picture) VALUES (?, ?, ?, ?, ?)',
      [id, profile.sub, profile.email, profile.name, profile.picture],
    )
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
    if (code !== 'ER_DUP_ENTRY') throw error
    const again = await query<UserRow[]>('SELECT id, google_sub, email, name, picture FROM users WHERE google_sub = ? OR email = ?', [profile.sub, profile.email])
    if (again[0]) return again[0]
    throw error
  }
  return { id, google_sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture } as UserRow
}

export async function issueTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = jwt.sign({ sub: userId }, secret(), { expiresIn: ACCESS_TTL })
  const refreshToken = randomBytes(32).toString('base64url')
  await execute('DELETE FROM refresh_tokens WHERE expires_at < UTC_TIMESTAMP()')
  await execute(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [randomUUID(), userId, hashToken(refreshToken), expiry()],
  )
  return { accessToken, refreshToken }
}

export async function refreshSubject(token: string): Promise<string> {
  if (token.length < 20 || token.length > 200) throw new HttpError(401, 'Sign in again.')
  const rows = await query<RowDataPacket[]>('SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?', [hashToken(token)])
  const row = rows[0] as { user_id?: string; expires_at?: string } | undefined
  if (!row?.user_id || !row.expires_at) throw new HttpError(401, 'Sign in again.')
  const expires = new Date(`${row.expires_at.replace(' ', 'T')}Z`)
  if (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now()) {
    await execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(token)])
    throw new HttpError(401, 'Sign in again.')
  }
  return row.user_id
}

export async function rotateRefresh(token: string): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
  if (token.length < 20 || token.length > 200) throw new HttpError(401, 'Sign in again.')
  const hash = hashToken(token)
  return withTransaction(async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ? FOR UPDATE',
      [hash],
    )
    const row = rows[0] as { user_id: string; expires_at: string } | undefined
    if (!row) throw new HttpError(401, 'Sign in again.')
    const expires = new Date(`${row.expires_at.replace(' ', 'T')}Z`)
    if (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now()) {
      await connection.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash])
      throw new HttpError(401, 'Sign in again.')
    }
    await connection.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash])
    const refreshToken = randomBytes(32).toString('base64url')
    const accessToken = jwt.sign({ sub: row.user_id }, secret(), { expiresIn: ACCESS_TTL })
    await connection.execute<ResultSetHeader>(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [randomUUID(), row.user_id, hashToken(refreshToken), expiry()],
    )
    return { userId: row.user_id, accessToken, refreshToken }
  })
}

export async function revokeRefresh(token: string): Promise<void> {
  if (token.length < 20 || token.length > 200) return
  await execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(token)])
}

export function readUserId(header: string | undefined): string {
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'Sign in again.')
  try {
    const payload = jwt.verify(token, secret())
    if (typeof payload === 'string' || !payload.sub) throw new Error('missing subject')
    return payload.sub
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(401, 'Sign in again.')
  }
}
