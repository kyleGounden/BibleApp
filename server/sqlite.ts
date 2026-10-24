import { mkdirSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type SqlValue = string | number | null | Date

export type SqlConn = {
  query: <T extends RowDataPacket[]>(sql: string, params?: SqlValue[]) => Promise<[T]>
  execute: <T extends ResultSetHeader = ResultSetHeader>(sql: string, params?: SqlValue[]) => Promise<[T]>
}

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  picture TEXT,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

CREATE TABLE IF NOT EXISTS churches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  timezone TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT PRIMARY KEY REFERENCES users (id),
  church_id TEXT NOT NULL REFERENCES churches (id),
  role TEXT NOT NULL CHECK (role IN ('pastor', 'member')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

CREATE INDEX IF NOT EXISTS idx_memberships_church ON memberships (church_id);

CREATE TABLE IF NOT EXISTS sermons (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches (id),
  author_id TEXT NOT NULL REFERENCES users (id),
  title TEXT NOT NULL,
  passage TEXT NOT NULL,
  message TEXT NOT NULL,
  sermon_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ended',
  current_step INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

CREATE INDEX IF NOT EXISTS idx_sermons_church_date ON sermons (church_id, sermon_date);

CREATE TABLE IF NOT EXISTS sermon_steps (
  id TEXT PRIMARY KEY,
  sermon_id TEXT NOT NULL REFERENCES sermons (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  heading TEXT NOT NULL DEFAULT '',
  passage TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sermon_steps_sermon ON sermon_steps (sermon_id, position);

CREATE TABLE IF NOT EXISTS shared_notes (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches (id),
  author_id TEXT NOT NULL REFERENCES users (id),
  verse_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  UNIQUE (church_id, author_id, verse_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens (expires_at);
`

let database: DatabaseSync | null = null
let queue: Promise<unknown> = Promise.resolve()

export function dataDirectory(): string {
  const configured = process.env.DATA_DIR?.trim()
  if (!configured) return join(process.cwd(), '.data')
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
}

function file(): DatabaseSync {
  if (database) return database
  const dir = dataDirectory()
  mkdirSync(dir, { recursive: true })
  const next = new DatabaseSync(join(dir, 'church.sqlite'))
  next.exec('PRAGMA foreign_keys = ON')
  next.exec(SCHEMA)
  migrateSermons(next)
  database = next
  return next
}

function migrateSermons(db: DatabaseSync): void {
  const rows = db.prepare('PRAGMA table_info(sermons)').all() as Array<{ name: string }>
  const names = new Set(rows.map((row) => row.name))
  if (!names.has('status')) db.exec("ALTER TABLE sermons ADD COLUMN status TEXT NOT NULL DEFAULT 'ended'")
  if (!names.has('current_step')) db.exec('ALTER TABLE sermons ADD COLUMN current_step INTEGER NOT NULL DEFAULT 0')
}

function translate(sql: string): string {
  return sql
    .replace(/UTC_TIMESTAMP\(\)/g, "strftime('%Y-%m-%d %H:%M:%S','now')")
    .replace(/FOR UPDATE/g, '')
    .replace(
      /ON DUPLICATE KEY UPDATE body = VALUES\(body\)/,
      "ON CONFLICT(church_id, author_id, verse_id) DO UPDATE SET body = excluded.body, updated_at = strftime('%Y-%m-%d %H:%M:%S','now')",
    )
}

function bind(params: SqlValue[] = []): Array<string | number | null> {
  return params.map((value) => {
    if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ')
    return value
  })
}

function duplicate(error: unknown): unknown {
  const message = error instanceof Error ? error.message : ''
  if (!message.includes('UNIQUE constraint failed')) return error
  const wrapped = new Error(message) as Error & { code: string }
  wrapped.code = 'ER_DUP_ENTRY'
  return wrapped
}

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn)
  queue = run.then(() => undefined, () => undefined)
  return run
}

function select<T extends RowDataPacket[]>(sql: string, params: SqlValue[] = []): T {
  const rows = file().prepare(translate(sql)).all(...bind(params))
  return rows as T
}

function change(sql: string, params: SqlValue[] = []): ResultSetHeader {
  const result = file().prepare(translate(sql)).run(...bind(params))
  return { affectedRows: Number(result.changes) } as ResultSetHeader
}

export function sqliteQuery<T extends RowDataPacket[]>(sql: string, params: SqlValue[] = []): Promise<T> {
  return serial(async () => {
    try {
      return select<T>(sql, params)
    } catch (error) {
      throw duplicate(error)
    }
  })
}

export function sqliteExecute(sql: string, params: SqlValue[] = []): Promise<ResultSetHeader> {
  return serial(async () => {
    try {
      return change(sql, params)
    } catch (error) {
      throw duplicate(error)
    }
  })
}

export function sqliteTransaction<T>(fn: (connection: SqlConn) => Promise<T>): Promise<T> {
  return serial(async () => {
    const db = file()
    const connection: SqlConn = {
      query: <T extends RowDataPacket[]>(sql: string, params: SqlValue[] = []) => Promise.resolve([select<T>(sql, params)]),
      execute: <T extends ResultSetHeader = ResultSetHeader>(sql: string, params: SqlValue[] = []) => Promise.resolve([change(sql, params) as T]),
    }
    db.exec('BEGIN')
    try {
      const result = await fn(connection)
      db.exec('COMMIT')
      return result
    } catch (error) {
      db.exec('ROLLBACK')
      throw duplicate(error)
    }
  })
}
