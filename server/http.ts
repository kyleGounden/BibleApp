import type { NextFunction, Request, Response } from 'express'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }
}

export function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\u0000/g, '').trim().slice(0, max)
}

export function isTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (!year || year < 1990 || year > 2100) return false
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1))
  return date.getUTCFullYear() === year && date.getUTCMonth() === (month || 1) - 1 && date.getUTCDate() === day
}

export function churchToday(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

const VERSE = /^[0-9A-Z]{2,4}\.\d{1,3}\.\d{1,3}$/

export function verseId(value: unknown): string {
  const id = clean(value, 32).toUpperCase()
  if (!VERSE.test(id)) throw new HttpError(400, 'That verse could not be shared.')
  return id
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function inviteCode(bytes: Buffer): string {
  let code = ''
  for (let index = 0; index < 8; index += 1) code += ALPHABET[(bytes[index] ?? 0) % ALPHABET.length]
  return code
}

export function normalizeCode(value: unknown): string {
  const code = clean(value, 24).toUpperCase().replace(/[^A-Z2-9]/g, '')
  if (code.length !== 8) throw new HttpError(400, 'Enter the eight-character invite code.')
  return code
}

export function databaseMessage(error: unknown): string | null {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ECONNRESET') {
    return 'The church database is not available yet.'
  }
  if (code === 'ER_ACCESS_DENIED_ERROR' || code === 'ER_BAD_DB_ERROR' || code === 'ER_DBACCESS_DENIED_ERROR') {
    return 'The church database is not available yet.'
  }
  if (error instanceof HttpError) return error.message
  return null
}
