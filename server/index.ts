import 'dotenv/config'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, sep } from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { parseSpokenRef, verseId as scriptureId } from '../src/lib/canon.js'
import { changePassword, issueTokens, loginAccount, readUserId, refreshSubject, registerAccount, revokeRefresh, rotateRefresh, upsertUser, verifyGoogle } from './auth.js'
import {
  database,
  execute,
  mysqlConfigured,
  query,
  withTransaction,
  type MemberRow,
  type MembershipRow,
  type NoteRow,
  type Role,
  type SermonRow,
  type SermonStatus,
  type StepRow,
  type UserRow,
} from './db.js'
import {
  churchToday,
  clean,
  databaseMessage,
  HttpError,
  inviteCode,
  isTimeZone,
  normalizeCode,
  route,
  verseId,
} from './http.js'
import { dataDirectory } from './sqlite.js'

const serving = process.argv.includes('--serve')
const dist = join(process.cwd(), 'dist')

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.googleusercontent.com https://accounts.google.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.dictionaryapi.dev https://en.wiktionary.org https://accounts.google.com https://fums.api.bible",
  "frame-src https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const app = express()
app.disable('x-powered-by')
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  next()
})
app.use(express.json({ limit: '128kb' }))

function localSecret(): void {
  if ((process.env.JWT_SECRET ?? '').length >= 16) return
  if (serving) {
    console.error('Set JWT_SECRET to at least 16 characters before starting the public server.')
    process.exit(1)
  }
  const dir = dataDirectory()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'session-secret')
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('base64url'))
  process.env.JWT_SECRET = readFileSync(file, 'utf8').trim()
}

localSecret()

const attempts = new Map<string, number[]>()

function limited(key: string): boolean {
  const now = Date.now()
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < 10 * 60 * 1000)
  recent.push(now)
  attempts.set(key, recent)
  return recent.length > 10
}

function clientAddress(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function limitedAddress(req: Request, action: string): void {
  if (limited(`${action}:${clientAddress(req)}`)) throw new HttpError(429, 'Wait a little, then try again.')
}

function duplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 'ER_DUP_ENTRY'
}

async function userById(id: string): Promise<UserRow | null> {
  const rows = await query<UserRow[]>('SELECT id, google_sub, email, name, picture, password_hash FROM users WHERE id = ?', [id])
  return rows[0] ?? null
}

async function membershipOf(userId: string): Promise<MembershipRow | null> {
  const rows = await query<MembershipRow[]>(
    `SELECT c.id, c.name, c.city, c.timezone, c.invite_code, m.role
     FROM memberships m
     JOIN churches c ON c.id = m.church_id
     WHERE m.user_id = ?`,
    [userId],
  )
  const row = rows[0]
  if (!row || (row.role !== 'pastor' && row.role !== 'member')) return null
  return row
}

async function membersOf(churchId: string): Promise<MemberRow[]> {
  return query<MemberRow[]>(
    `SELECT u.id, u.name, u.email, m.role
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.church_id = ?
     ORDER BY CASE m.role WHEN 'pastor' THEN 0 ELSE 1 END, u.name ASC`,
    [churchId],
  )
}

function presentUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    hasPassword: Boolean(user.password_hash),
  }
}

function presentChurch(row: MembershipRow) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    timezone: row.timezone,
    inviteCode: row.role === 'pastor' ? row.invite_code : null,
  }
}

async function profile(userId: string) {
  const user = await userById(userId)
  if (!user) throw new HttpError(401, 'Sign in again.')
  const membership = await membershipOf(userId)
  const members = membership?.role === 'pastor' ? await membersOf(membership.id) : []
  return {
    user: presentUser(user),
    church: membership ? presentChurch(membership) : null,
    role: membership?.role ?? null,
    members: members.map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role })),
  }
}

async function requirePastor(userId: string): Promise<MembershipRow> {
  const membership = await membershipOf(userId)
  if (!membership || membership.role !== 'pastor') throw new HttpError(403, 'Only a pastor can do that.')
  return membership
}

function bodyOf(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return {}
  return req.body as Record<string, unknown>
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: mysqlConfigured() ? 'mysql' : 'sqlite' })
})

app.get('/api/config', (_req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID ?? '' })
})

app.use('/esv-api', route(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'That request could not be read.')
  const path = req.originalUrl.replace(/^\/esv-api/, '') || '/'
  const target = new URL(path, 'https://api.esv.org')
  if (target.origin !== 'https://api.esv.org') throw new HttpError(400, 'That request could not be read.')
  const headers: Record<string, string> = { Accept: req.header('accept') || 'application/json' }
  const authorization = req.header('authorization')
  if (authorization) headers.Authorization = authorization
  let upstream: globalThis.Response
  try {
    upstream = await fetch(target, { method: req.method, headers })
  } catch {
    throw new HttpError(502, 'Crossway did not return the text.')
  }
  const type = upstream.headers.get('content-type')
  res.status(upstream.status)
  if (type) res.setHeader('Content-Type', type)
  res.send(Buffer.from(await upstream.arrayBuffer()))
}))

const NIV_BIBLE_ID = '78a9f6124f344018-01'

app.use('/bible-api', route(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'That request could not be read.')
  const key = (process.env.BIBLE_API_KEY ?? '').trim()
  if (!key) throw new HttpError(503, 'The NIV key is not set on this server.')
  const path = req.originalUrl.replace(/^\/bible-api/, '') || '/'
  const target = new URL(path, 'https://rest.api.bible')
  if (target.origin !== 'https://rest.api.bible') throw new HttpError(400, 'That request could not be read.')
  if (!target.pathname.startsWith(`/v1/bibles/${NIV_BIBLE_ID}/`)) throw new HttpError(404, 'That Bible text is not available.')
  let upstream: globalThis.Response
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: { Accept: 'application/json', 'api-key': key },
    })
  } catch {
    throw new HttpError(502, 'API.Bible did not return the text.')
  }
  const type = upstream.headers.get('content-type')
  res.status(upstream.status)
  if (type) res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.send(Buffer.from(await upstream.arrayBuffer()))
}))

app.post('/api/auth/google', route(async (req, res) => {
  limitedAddress(req, 'google')
  const credential = bodyOf(req).credential
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 8192) {
    throw new HttpError(401, 'Google did not confirm this account.')
  }
  const user = await upsertUser(await verifyGoogle(credential))
  const tokens = await issueTokens(user.id)
  res.json({ ...tokens, ...(await profile(user.id)) })
}))

function accountFields(body: Record<string, unknown>, creating: boolean) {
  const email = clean(body.email, 255).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  const name = clean(body.name, 255)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email.')
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Use a password of at least 8 characters.')
  if (creating && !name) throw new HttpError(400, 'Enter your name.')
  return { email, password, name }
}

app.post('/api/auth/register', route(async (req, res) => {
  limitedAddress(req, 'register')
  const fields = accountFields(bodyOf(req), true)
  const user = await registerAccount(fields.name, fields.email, fields.password)
  const tokens = await issueTokens(user.id)
  res.json({ ...tokens, ...(await profile(user.id)) })
}))

app.post('/api/auth/login', route(async (req, res) => {
  limitedAddress(req, 'login')
  const fields = accountFields(bodyOf(req), false)
  const user = await loginAccount(fields.email, fields.password)
  const tokens = await issueTokens(user.id)
  res.json({ ...tokens, ...(await profile(user.id)) })
}))

app.post('/api/auth/refresh', route(async (req, res) => {
  const refreshToken = bodyOf(req).refreshToken
  if (typeof refreshToken !== 'string') throw new HttpError(401, 'Sign in again.')
  const userId = await refreshSubject(refreshToken)
  const body = await profile(userId)
  const rotated = await rotateRefresh(refreshToken)
  res.json({
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    ...body,
  })
}))

app.post('/api/auth/password', route(async (req, res) => {
  limitedAddress(req, 'password')
  const userId = readUserId(req.header('authorization'))
  const body = bodyOf(req)
  const current = typeof body.current === 'string' ? body.current : ''
  const next = typeof body.next === 'string' ? body.next : ''
  await changePassword(userId, current, next)
  res.json({ ok: true })
}))

app.post('/api/auth/logout', route(async (req, res) => {
  const refreshToken = bodyOf(req).refreshToken
  if (typeof refreshToken === 'string') await revokeRefresh(refreshToken)
  res.json({ ok: true })
}))

app.get('/api/me', route(async (req, res) => {
  res.json(await profile(readUserId(req.header('authorization'))))
}))

app.post('/api/church', route(async (req, res) => {
  const userId = readUserId(req.header('authorization'))
  if (await membershipOf(userId)) throw new HttpError(409, 'You already belong to a church.')
  const body = bodyOf(req)
  const name = clean(body.name, 160)
  const city = clean(body.city, 120)
  const timezone = clean(body.timezone, 64)
  if (!name || !city) throw new HttpError(400, 'A church needs a name and a city.')
  if (!isTimeZone(timezone)) throw new HttpError(400, 'That timezone could not be used.')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const churchId = randomUUID()
    const code = inviteCode(randomBytes(8))
    try {
      await withTransaction(async (connection) => {
        await connection.execute(
          'INSERT INTO churches (id, name, city, timezone, invite_code, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [churchId, name, city, timezone, code, userId],
        )
        await connection.execute(
          'INSERT INTO memberships (user_id, church_id, role) VALUES (?, ?, ?)',
          [userId, churchId, 'pastor'],
        )
      })
      res.json(await profile(userId))
      return
    } catch (error) {
      if (duplicate(error) && attempt < 4) continue
      if (duplicate(error)) throw new HttpError(409, 'You already belong to a church.')
      throw error
    }
  }
}))

app.post('/api/church/join', route(async (req, res) => {
  const userId = readUserId(req.header('authorization'))
  if (limited(`join:${clientAddress(req)}`) || limited(`join-user:${userId}`)) {
    throw new HttpError(429, 'Wait a little, then try the code again.')
  }
  const code = normalizeCode(bodyOf(req).code)
  const churches = await query<RowDataPacket[]>('SELECT id FROM churches WHERE invite_code = ?', [code])
  const churchId = typeof churches[0]?.id === 'string' ? churches[0].id : ''
  if (!churchId) throw new HttpError(404, 'That invite code is not a church.')
  const mine = await membershipOf(userId)
  if (mine?.id === churchId) {
    res.json(await profile(userId))
    return
  }
  if (mine) throw new HttpError(409, 'You already belong to a church.')
  try {
    await execute('INSERT INTO memberships (user_id, church_id, role) VALUES (?, ?, ?)', [userId, churchId, 'member'])
  } catch (error) {
    if (duplicate(error)) throw new HttpError(409, 'You already belong to a church.')
    throw error
  }
  res.json(await profile(userId))
}))

app.post('/api/church/invite', route(async (req, res) => {
  const membership = await requirePastor(readUserId(req.header('authorization')))
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = inviteCode(randomBytes(8))
    try {
      await execute('UPDATE churches SET invite_code = ? WHERE id = ?', [code, membership.id])
      res.json(await profile(readUserId(req.header('authorization'))))
      return
    } catch (error) {
      if (duplicate(error) && attempt < 4) continue
      throw error
    }
  }
}))

app.post('/api/church/members/:id/role', route(async (req, res) => {
  const membership = await requirePastor(readUserId(req.header('authorization')))
  const role = bodyOf(req).role
  if (role !== 'pastor' && role !== 'member') throw new HttpError(400, 'Choose pastor or member.')
  const targetId = clean(req.params.id, 36)
  const rows = await query<Array<RowDataPacket & { role: Role }>>(
    'SELECT role FROM memberships WHERE user_id = ? AND church_id = ?',
    [targetId, membership.id],
  )
  if (!rows[0]) throw new HttpError(404, 'That person is not in this church.')
  if (role === 'member' && rows[0].role === 'pastor') {
    const pastors = await query<Array<RowDataPacket & { n: number }>>(
      'SELECT COUNT(*) AS n FROM memberships WHERE church_id = ? AND role = ?',
      [membership.id, 'pastor'],
    )
    if (Number(pastors[0]?.n ?? 0) <= 1) throw new HttpError(400, 'Choose another pastor first.')
  }
  await execute('UPDATE memberships SET role = ? WHERE user_id = ? AND church_id = ?', [role, targetId, membership.id])
  res.json(await profile(readUserId(req.header('authorization'))))
}))

app.delete('/api/church/membership', route(async (req, res) => {
  const userId = readUserId(req.header('authorization'))
  await withTransaction(async (connection) => {
    const [mineRows] = await connection.query<MembershipRow[]>(
      `SELECT c.id, c.name, c.city, c.timezone, c.invite_code, m.role
       FROM memberships m
       JOIN churches c ON c.id = m.church_id
       WHERE m.user_id = ?
       FOR UPDATE`,
      [userId],
    )
    const mine = mineRows[0]
    if (!mine) throw new HttpError(404, 'You are not in a church.')
    const [counts] = await connection.query<Array<RowDataPacket & { people: number; pastors: number }>>(
      `SELECT COUNT(*) AS people,
              SUM(role = 'pastor') AS pastors
       FROM memberships
       WHERE church_id = ?
       FOR UPDATE`,
      [mine.id],
    )
    const people = Number(counts[0]?.people ?? 0)
    const pastors = Number(counts[0]?.pastors ?? 0)
    if (mine.role === 'pastor' && pastors <= 1 && people > 1) {
      throw new HttpError(400, 'Choose another pastor before you leave.')
    }
    if (people <= 1) {
      await connection.execute('DELETE FROM shared_notes WHERE church_id = ?', [mine.id])
      await connection.execute('DELETE FROM sermon_steps WHERE sermon_id IN (SELECT id FROM sermons WHERE church_id = ?)', [mine.id])
      await connection.execute('DELETE FROM sermons WHERE church_id = ?', [mine.id])
      await connection.execute('DELETE FROM memberships WHERE church_id = ?', [mine.id])
      await connection.execute('DELETE FROM churches WHERE id = ?', [mine.id])
      return
    }
    await connection.execute('DELETE FROM memberships WHERE user_id = ? AND church_id = ?', [userId, mine.id])
  })
  res.json(await profile(userId))
}))

const STEP_CAP = 20

type StoredStep = {
  position: number
  heading: string
  passage: string
  note: string
}

type PresentedStep = StoredStep & { id: string }

function sermonStatus(value: string): SermonStatus {
  if (value === 'draft' || value === 'live' || value === 'ended') return value
  return 'ended'
}

function fallbackStep(sermon: { id: string; passage: string; message: string }): PresentedStep {
  const parsed = parseSpokenRef(sermon.passage)
  return {
    id: sermon.id,
    position: 0,
    heading: parsed ? '' : sermon.passage,
    passage: parsed ? scriptureId(parsed.book, parsed.chapter, parsed.verse, parsed.end) : '',
    note: sermon.message,
  }
}

function presentSermon(sermon: SermonRow, steps: PresentedStep[] | undefined) {
  const ready = steps?.length ? steps : [fallbackStep(sermon)]
  const current = Math.max(0, Number(sermon.current_step) || 0)
  return {
    id: sermon.id,
    title: sermon.title,
    status: sermonStatus(String(sermon.status ?? 'ended')),
    currentStep: Math.min(current, ready.length - 1),
    sermonDate: String(sermon.sermon_date).slice(0, 10),
    authorName: sermon.author_name,
    passage: sermon.passage,
    message: sermon.message,
    steps: ready,
  }
}

async function stepsFor(ids: string[]): Promise<Map<string, PresentedStep[]>> {
  const map = new Map<string, PresentedStep[]>()
  if (!ids.length) return map
  const marks = ids.map(() => '?').join(', ')
  const rows = await query<StepRow[]>(
    `SELECT id, sermon_id, position, heading, passage, note
     FROM sermon_steps
     WHERE sermon_id IN (${marks})
     ORDER BY position ASC, id ASC`,
    ids,
  )
  for (const row of rows) {
    const list = map.get(row.sermon_id) ?? []
    list.push({
      id: row.id,
      position: Number(row.position),
      heading: row.heading,
      passage: row.passage,
      note: row.note,
    })
    map.set(row.sermon_id, list)
  }
  return map
}

async function loadChurchSermons(churchId: string, pastor: boolean): Promise<SermonRow[]> {
  let sql = `SELECT s.id, s.title, s.passage, s.message, s.sermon_date, s.status, s.current_step, u.name AS author_name
             FROM sermons s
             JOIN users u ON u.id = s.author_id
             WHERE s.church_id = ?`
  if (!pastor) sql += ` AND s.status IN ('live', 'ended')`
  sql += ` ORDER BY CASE s.status WHEN 'live' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, s.sermon_date DESC, s.created_at DESC`
  return query<SermonRow[]>(sql, [churchId])
}

app.get('/api/sermons/live', route(async (req, res) => {
  const membership = await membershipOf(readUserId(req.header('authorization')))
  if (!membership) throw new HttpError(404, 'Join a church first.')
  const rows = await query<SermonRow[]>(
    `SELECT s.id, s.title, s.passage, s.message, s.sermon_date, s.status, s.current_step, u.name AS author_name
     FROM sermons s
     JOIN users u ON u.id = s.author_id
     WHERE s.church_id = ? AND s.status = 'live'
     ORDER BY s.updated_at DESC
     LIMIT 1`,
    [membership.id],
  )
  const sermon = rows[0]
  if (!sermon) {
    res.json({ sermon: null })
    return
  }
  const steps = await stepsFor([sermon.id])
  res.json({ sermon: presentSermon(sermon, steps.get(sermon.id)) })
}))

app.get('/api/sermons', route(async (req, res) => {
  const membership = await membershipOf(readUserId(req.header('authorization')))
  if (!membership) throw new HttpError(404, 'Join a church first.')
  const today = churchToday(membership.timezone)
  const sermons = await loadChurchSermons(membership.id, membership.role === 'pastor')
  const steps = await stepsFor(sermons.map((sermon) => sermon.id))
  res.json({
    today,
    sermons: sermons.map((sermon) => presentSermon(sermon, steps.get(sermon.id))),
  })
}))

function sermonInput(body: Record<string, unknown>) {
  const title = clean(body.title, 160)
  if (!title) throw new HttpError(400, 'A sermon needs a title.')
  if (!Array.isArray(body.steps) || !body.steps.length) throw new HttpError(400, 'Add at least one step.')
  if (body.steps.length > STEP_CAP) throw new HttpError(400, 'A sermon can have twenty steps.')
  const steps: StoredStep[] = body.steps.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'A step could not be read.')
    const record = item as Record<string, unknown>
    const heading = clean(record.heading, 160)
    const spoken = clean(record.passage, 80)
    const note = clean(record.note, 4000)
    if (!heading && !spoken && !note) throw new HttpError(400, 'Each step needs a heading, a passage, or a note.')
    let passage = ''
    if (spoken) {
      const parsed = parseSpokenRef(spoken)
      if (!parsed) throw new HttpError(400, `"${spoken}" is not a passage this Bible can open.`)
      passage = scriptureId(parsed.book, parsed.chapter, parsed.verse, parsed.end)
    }
    return { position: 0, heading, passage, note }
  }).map((step, index) => ({ ...step, position: index }))
  const first = steps.find((step) => step.passage)
  const message = steps.map((step) => step.note).filter(Boolean).join('\n\n').slice(0, 20000)
  return { title, steps, passage: first?.passage ?? '', message }
}

async function insertSteps(connection: { execute: (sql: string, params?: Array<string | number | null>) => Promise<unknown> }, sermonId: string, steps: StoredStep[]): Promise<void> {
  for (const step of steps) {
    await connection.execute(
      `INSERT INTO sermon_steps (id, sermon_id, position, heading, passage, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), sermonId, step.position, step.heading, step.passage, step.note],
    )
  }
}

app.post('/api/sermons', route(async (req, res) => {
  const userId = readUserId(req.header('authorization'))
  const membership = await requirePastor(userId)
  const input = sermonInput(bodyOf(req))
  const id = randomUUID()
  const today = churchToday(membership.timezone)
  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO sermons (id, church_id, author_id, title, passage, message, sermon_date, status, current_step)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0)`,
      [id, membership.id, userId, input.title, input.passage, input.message, today],
    )
    await insertSteps(connection, id, input.steps)
  })
  res.json({ id })
}))

app.patch('/api/sermons/:id', route(async (req, res) => {
  const userId = readUserId(req.header('authorization'))
  const membership = await requirePastor(userId)
  const input = sermonInput(bodyOf(req))
  const id = clean(req.params.id, 36)
  await withTransaction(async (connection) => {
    const [rows] = await connection.query<Array<RowDataPacket & { current_step: number }>>(
      'SELECT current_step FROM sermons WHERE id = ? AND church_id = ?',
      [id, membership.id],
    )
    if (!rows[0]) throw new HttpError(404, 'That sermon is not in this church.')
    await connection.execute(
      `UPDATE sermons
       SET title = ?, passage = ?, message = ?, author_id = ?
       WHERE id = ? AND church_id = ?`,
      [input.title, input.passage, input.message, userId, id, membership.id],
    )
    await connection.execute('DELETE FROM sermon_steps WHERE sermon_id = ?', [id])
    await insertSteps(connection, id, input.steps)
    const current = Number(rows[0].current_step) || 0
    if (current >= input.steps.length) {
      await connection.execute('UPDATE sermons SET current_step = ? WHERE id = ? AND church_id = ?', [input.steps.length - 1, id, membership.id])
    }
  })
  res.json({ ok: true })
}))

app.delete('/api/sermons/:id', route(async (req, res) => {
  const membership = await requirePastor(readUserId(req.header('authorization')))
  const id = clean(req.params.id, 36)
  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM sermon_steps WHERE sermon_id = ?', [id])
    const [result] = await connection.execute('DELETE FROM sermons WHERE id = ? AND church_id = ?', [id, membership.id])
    if (!result.affectedRows) throw new HttpError(404, 'That sermon is not in this church.')
  })
  res.json({ ok: true })
}))

app.post('/api/sermons/:id/live', route(async (req, res) => {
  const membership = await requirePastor(readUserId(req.header('authorization')))
  const id = clean(req.params.id, 36)
  const body = bodyOf(req)
  const action = clean(body.action, 8)
  if (action !== 'start' && action !== 'end' && action !== 'step') throw new HttpError(400, 'Choose start, end, or a step.')
  await withTransaction(async (connection) => {
    const [rows] = await connection.query<Array<RowDataPacket & { status: string; passage: string; message: string }>>(
      'SELECT status, passage, message FROM sermons WHERE id = ? AND church_id = ?',
      [id, membership.id],
    )
    if (!rows[0]) throw new HttpError(404, 'That sermon is not in this church.')
    if (action === 'start') {
      const [counts] = await connection.query<Array<RowDataPacket & { n: number }>>(
        'SELECT COUNT(*) AS n FROM sermon_steps WHERE sermon_id = ?',
        [id],
      )
      if (!Number(counts[0]?.n)) {
        const kept = fallbackStep({
          id,
          passage: String(rows[0].passage ?? ''),
          message: String(rows[0].message ?? ''),
        })
        if (!kept.heading && !kept.passage && !kept.note) throw new HttpError(400, 'Add a passage or a note before you start.')
        await insertSteps(connection, id, [kept])
      }
      await connection.execute(
        `UPDATE sermons SET status = 'ended' WHERE church_id = ? AND status = 'live' AND id <> ?`,
        [membership.id, id],
      )
      await connection.execute(
        `UPDATE sermons SET status = 'live', current_step = 0, sermon_date = ? WHERE id = ? AND church_id = ?`,
        [churchToday(membership.timezone), id, membership.id],
      )
      return
    }
    if (String(rows[0].status) !== 'live') throw new HttpError(400, 'That service is not live.')
    if (action === 'end') {
      await connection.execute(`UPDATE sermons SET status = 'ended' WHERE id = ? AND church_id = ?`, [id, membership.id])
      return
    }
    const step = body.step
    if (typeof step !== 'number' || !Number.isInteger(step) || step < 0) throw new HttpError(400, 'Choose a step in this sermon.')
    const [counts] = await connection.query<Array<RowDataPacket & { n: number }>>(
      'SELECT COUNT(*) AS n FROM sermon_steps WHERE sermon_id = ?',
      [id],
    )
    if (step >= Number(counts[0]?.n ?? 0)) throw new HttpError(400, 'Choose a step in this sermon.')
    await connection.execute(
      'UPDATE sermons SET current_step = ? WHERE id = ? AND church_id = ?',
      [step, id, membership.id],
    )
  })
  res.json({ ok: true })
}))

app.get('/api/notes', route(async (req, res) => {
  const membership = await membershipOf(readUserId(req.header('authorization')))
  if (!membership) throw new HttpError(404, 'Join a church first.')
  const verse = typeof req.query.verse === 'string' && req.query.verse ? verseId(req.query.verse) : ''
  const params: string[] = [membership.id]
  let sql = `SELECT n.id, n.verse_id, n.body, n.author_id, u.name AS author_name
             FROM shared_notes n
             JOIN users u ON u.id = n.author_id
             WHERE n.church_id = ?`
  if (verse) {
    sql += ' AND n.verse_id = ?'
    params.push(verse)
  }
  sql += ' ORDER BY n.updated_at DESC'
  if (!verse) sql += ' LIMIT 40'
  const notes = await query<NoteRow[]>(sql, params)
  res.json({
    notes: notes.map((note) => ({
      id: note.id,
      verseId: note.verse_id,
      body: note.body,
      authorId: note.author_id,
      authorName: note.author_name,
    })),
  })
}))

app.put('/api/notes', route(async (req, res) => {
  const userId = readUserId(req.header('authorization'))
  const membership = await requirePastor(userId)
  const body = bodyOf(req)
  const id = verseId(body.verseId)
  const text = clean(body.body, 2000)
  if (!text) throw new HttpError(400, 'Write a note before sharing it.')
  await execute(
    `INSERT INTO shared_notes (id, church_id, author_id, verse_id, body)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE body = VALUES(body)`,
    [randomUUID(), membership.id, userId, id, text],
  )
  res.json({ ok: true })
}))

app.delete('/api/notes', route(async (req, res) => {
  const userId = readUserId(req.header('authorization'))
  const membership = await requirePastor(userId)
  const id = verseId(req.query.verse)
  await execute('DELETE FROM shared_notes WHERE church_id = ? AND author_id = ? AND verse_id = ?', [membership.id, userId, id])
  res.json({ ok: true })
}))

if (serving) {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('Build the site first with npm run build.')
    process.exit(1)
  }
  app.use(express.static(dist, {
    index: false,
    setHeaders(res, filePath) {
      const name = basename(filePath)
      if (name === 'index.html' || name === 'sw.js' || name === 'boot.js') {
        res.setHeader('Cache-Control', 'no-cache')
        return
      }
      if (filePath.includes(`${sep}assets${sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }
    },
  }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    if (req.path.startsWith('/api') || req.path.startsWith('/esv-api') || req.path.startsWith('/bible-api') || req.path.includes('.')) {
      res.status(404).type('text/plain').send('Not found.')
      return
    }
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(join(dist, 'index.html'), (error) => {
      if (error) next(error)
    })
  })
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  if (error instanceof SyntaxError && 'status' in error && (error as { status?: number }).status === 400) {
    res.status(400).json({ error: 'That request could not be read.' })
    return
  }
  console.error(error)
  const message = databaseMessage(error) ?? 'The church service could not complete that.'
  res.status(message === 'The church service could not complete that.' ? 500 : 503).json({ error: message })
})

const port = Number(process.env.PORT || process.env.HTTP_PLATFORM_PORT || process.env.API_PORT || 8787)
const host = process.env.HOST || (process.env.HTTP_PLATFORM_PORT ? '127.0.0.1' : serving ? '0.0.0.0' : '127.0.0.1')
const server = app.listen(port, host, () => {
  if (!process.env.GOOGLE_CLIENT_ID) console.log('Church API: Google sign-in can be added later.')
  if (!mysqlConfigured()) console.log('Church API: using a local database until MySQL is configured.')
  else {
    database()
      .then(() => console.log('Church database is ready.'))
      .catch((error: unknown) => console.error('Church database is not available.', error))
  }
  console.log(`Church API on http://${host}:${port}`)
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    if (serving) {
      console.error(`Port ${port} is already in use.`)
      process.exit(1)
    }
    console.log(`Church API already listening on ${port}.`)
    process.exit(0)
  }
  console.error(error)
  process.exit(1)
})
