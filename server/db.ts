import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { HttpError } from './http.js'
import { sqliteExecute, sqliteQuery, sqliteTransaction, type SqlConn } from './sqlite.js'

export type Role = 'pastor' | 'member'

export type UserRow = RowDataPacket & {
  id: string
  google_sub: string | null
  email: string
  name: string
  picture: string | null
  password_hash?: string | null
}

export type MembershipRow = RowDataPacket & {
  id: string
  name: string
  city: string
  timezone: string
  invite_code: string
  role: Role
}

export type MemberRow = RowDataPacket & {
  id: string
  name: string
  email: string
  role: Role
}

export type SermonStatus = 'draft' | 'live' | 'ended'

export type SermonRow = RowDataPacket & {
  id: string
  title: string
  passage: string
  message: string
  sermon_date: string
  author_name: string
  status: SermonStatus | string
  current_step: number
}

export type StepRow = RowDataPacket & {
  id: string
  sermon_id: string
  position: number
  heading: string
  passage: string
  note: string
}

export type NoteRow = RowDataPacket & {
  id: string
  verse_id: string
  body: string
  author_id: string
  author_name: string
}

export type CountRow = RowDataPacket & { n: number }

function configured(): boolean {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE)
}

function pool(): Pool {
  if (!configured()) throw new HttpError(503, 'The church database is not configured yet.')
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    dateStrings: true,
    timezone: 'Z',
  })
}

let shared: Pool | null = null
let opening: Promise<Pool> | null = null
let failedAt = 0

function statements(): string[] {
  const file = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql')
  const sql = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  return sql.split(';').map((statement) => statement.trim()).filter(Boolean)
}

async function prepareAccounts(connection: PoolConnection): Promise<void> {
  const [columns] = await connection.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
  )
  const names = new Set(columns.map((column) => String(column.COLUMN_NAME)))
  const google = columns.find((column) => column.COLUMN_NAME === 'google_sub')
  if (google && google.IS_NULLABLE === 'NO') {
    await connection.query('ALTER TABLE users MODIFY google_sub VARCHAR(255) NULL')
  }
  if (!names.has('password_hash')) {
    await connection.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL')
  }
  const [indexes] = await connection.query<RowDataPacket[]>(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uniq_users_email'`,
  )
  if (!indexes.length) await connection.query('ALTER TABLE users ADD UNIQUE KEY uniq_users_email (email)')
}

async function prepareSermons(connection: PoolConnection): Promise<void> {
  const [columns] = await connection.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sermons'`,
  )
  const names = new Set(columns.map((column) => String(column.COLUMN_NAME)))
  if (!names.has('status')) {
    await connection.query("ALTER TABLE sermons ADD COLUMN status VARCHAR(8) NOT NULL DEFAULT 'ended'")
  }
  if (!names.has('current_step')) {
    await connection.query('ALTER TABLE sermons ADD COLUMN current_step INT NOT NULL DEFAULT 0')
  }
}

async function open(): Promise<Pool> {
  const next = pool()
  try {
    const connection = await next.getConnection()
    try {
      for (const statement of statements()) await connection.query(statement)
      await prepareAccounts(connection)
      await prepareSermons(connection)
    } finally {
      connection.release()
    }
    shared = next
    return next
  } catch (error) {
    await next.end().catch(() => undefined)
    throw error
  }
}

export function database(): Promise<Pool> {
  if (shared) return Promise.resolve(shared)
  if (opening) return opening
  if (failedAt && Date.now() - failedAt < 3000) {
    return Promise.reject(new HttpError(503, 'The church database is not available yet.'))
  }
  opening = open().catch((error: unknown) => {
    opening = null
    if (!(error instanceof HttpError)) failedAt = Date.now()
    throw error
  })
  return opening
}

export type { SqlConn }

type SqlValue = string | number | null | Date

export function mysqlConfigured(): boolean {
  return configured()
}

export async function query<T extends RowDataPacket[]>(sql: string, params: SqlValue[] = []): Promise<T> {
  if (!configured()) return sqliteQuery<T>(sql, params)
  const db = await database()
  const [rows] = await db.query<T>(sql, params)
  return rows
}

export async function execute(sql: string, params: SqlValue[] = []): Promise<ResultSetHeader> {
  if (!configured()) return sqliteExecute(sql, params)
  const db = await database()
  const [result] = await db.execute<ResultSetHeader>(sql, params)
  return result
}

export async function withTransaction<T>(fn: (connection: SqlConn) => Promise<T>): Promise<T> {
  if (!configured()) return sqliteTransaction(fn)
  const db = await database()
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const result = await fn(connection as unknown as SqlConn)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
