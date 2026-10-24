import { useSyncExternalStore } from 'react'
import { BOOKS, bookById, bookName, parseRef, verseId } from './canon'

const TOKEN_KEY = 'scripture.esv.token'
const CACHE_LIMIT = 500

const listeners = new Set<() => void>()
const verseCache = new Map<string, string>()
const inflight = new Map<string, Promise<Record<string, string>>>()

const textParams: Record<string, string> = {
  'include-headings': 'false',
  'include-footnotes': 'false',
  'include-footnote-body': 'false',
  'include-passage-references': 'false',
  'include-short-copyright': 'false',
  'include-copyright': 'false',
  'include-verse-numbers': 'true',
  'include-first-verse-numbers': 'true',
  'indent-poetry': 'false',
  'indent-paragraphs': '0',
  'indent-declares': '0',
  'indent-psalm-doxology': '0',
  'line-length': '0',
}

export class EsvError extends Error {
  reason: 'key' | 'denied' | 'limit' | 'network'

  constructor(reason: 'key' | 'denied' | 'limit' | 'network', message: string) {
    super(message)
    this.name = 'EsvError'
    this.reason = reason
  }
}

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function getEsvToken(): string {
  return readToken()
}

export function setEsvToken(token: string): void {
  const trimmed = token.trim().replace(/^['"]|['"]$/g, '').replace(/^Token\s+/i, '').trim()
  try {
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode */
  }
  verseCache.clear()
  listeners.forEach((listener) => listener())
}

export function subscribeEsvToken(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useEsvToken(): string {
  return useSyncExternalStore(subscribeEsvToken, getEsvToken, () => '')
}

export function esvBookName(bookId: string): string {
  if (bookId === 'PSA') return 'Psalm'
  return bookName(bookId)
}

export function esvQuery(bookId: string, chapter: number, verse?: number, end?: number): string {
  const name = esvBookName(bookId)
  if (!verse) return `${name} ${chapter}`
  if (end && end > verse) return `${name} ${chapter}:${verse}-${end}`
  return `${name} ${chapter}:${verse}`
}

const nameToBook = new Map<string, string>()
for (const book of BOOKS) nameToBook.set(book.name.toLowerCase(), book.id)
nameToBook.set('psalm', 'PSA')
nameToBook.set('psalms', 'PSA')
nameToBook.set('song of songs', 'SNG')

export function esvReferenceToId(reference: string): string | null {
  const match = reference.trim().match(/^(.+?)\s+(\d+):(\d+)/)
  if (!match) return null
  const book = nameToBook.get(match[1].toLowerCase())
  if (!book) return null
  return verseId(book, Number(match[2]), Number(match[3]))
}

export function parseEsvPassage(passage: string): Record<string, string> {
  const source = passage.replace(/\s*\(ESV\)\s*$/i, '')
  const marks: { verse: number; index: number; length: number }[] = []
  const re = /\[(\d+)\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    marks.push({ verse: Number(match[1]), index: match.index, length: match[0].length })
  }
  const verses: Record<string, string> = {}
  for (let index = 0; index < marks.length; index += 1) {
    const start = marks[index].index + marks[index].length
    const end = index + 1 < marks.length ? marks[index + 1].index : source.length
    const text = source.slice(start, end).replace(/\s+/g, ' ').trim()
    if (text) verses[String(marks[index].verse)] = text
  }
  return verses
}

function rememberVerse(id: string, text: string): void {
  if (verseCache.has(id)) verseCache.delete(id)
  verseCache.set(id, text)
  while (verseCache.size > CACHE_LIMIT) {
    const oldest = verseCache.keys().next().value
    if (!oldest) break
    verseCache.delete(oldest)
  }
}

function nativePlatform(): boolean {
  const native = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return Boolean(native?.isNativePlatform?.())
}

async function esvSend<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = readToken()
  if (!token) throw new EsvError('key', 'Add your free ESV key. Crossway sends the text from their server.')
  const query = new URLSearchParams(params).toString()
  const headers = { Authorization: `Token ${token}`, Accept: 'application/json' }
  let status = 0
  let body: T | null = null
  if (nativePlatform()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const response = await CapacitorHttp.get({ url: `https://api.esv.org${path}?${query}`, headers })
    status = response.status
    body = (typeof response.data === 'string' ? JSON.parse(response.data) : response.data) as T
  } else {
    const response = await fetch(`/esv-api${path}?${query}`, { headers })
    status = response.status
    const raw = await response.text()
    try {
      body = JSON.parse(raw) as T
    } catch {
      body = null
    }
  }
  const detail = body && typeof body === 'object' && 'detail' in body ? String((body as { detail?: unknown }).detail ?? '') : ''
  if (status === 401 || /invalid application key/i.test(detail)) throw new EsvError('denied', 'Crossway did not accept that key.')
  if (status === 403 || status === 429) throw new EsvError('limit', 'Crossway is limiting requests for a while. Wait and open the chapter again.')
  if (!body || status < 200 || status >= 300) {
    throw new EsvError(
      'network',
      body
        ? 'Crossway did not return the text. Try the chapter again.'
        : 'The ESV text did not load. Try the chapter again.',
    )
  }
  return body
}

async function passageVerses(bookId: string, chapter: number, verse?: number, end?: number): Promise<Record<string, string>> {
  const query = esvQuery(bookId, chapter, verse, end)
  const pending = inflight.get(query)
  if (pending) return pending
  const request = esvSend<{ passages?: string[] }>('/v3/passage/text/', { q: query, ...textParams })
    .then((data) => {
      const verses = parseEsvPassage((data.passages ?? []).join('\n'))
      for (const [number, text] of Object.entries(verses)) {
        rememberVerse(verseId(bookId, chapter, Number(number)), text)
      }
      return verses
    })
    .finally(() => inflight.delete(query))
  inflight.set(query, request)
  return request
}

export async function loadEsvChapter(bookId: string, chapter: number): Promise<{ chapters: Record<string, Record<string, string>> }> {
  const book = bookById(bookId)
  if (!book || chapter < 1 || chapter > book.chapters) throw new EsvError('network', 'That chapter is not in the canon.')
  const verses = await passageVerses(bookId, chapter)
  if (!Object.keys(verses).length) throw new EsvError('network', 'Crossway sent no text for this chapter.')
  return { chapters: { [String(chapter)]: verses } }
}

export async function readEsvVerse(id: string): Promise<string> {
  const parsed = parseRef(id)
  if (!parsed) throw new EsvError('network', 'That verse is not in the canon.')
  const key = verseId(parsed.book, parsed.chapter, parsed.verse)
  const cached = verseCache.get(key)
  if (cached) {
    verseCache.delete(key)
    verseCache.set(key, cached)
    return cached
  }
  const verses = await passageVerses(parsed.book, parsed.chapter, parsed.verse)
  const text = verses[String(parsed.verse)]
  if (!text) throw new EsvError('network', 'Crossway sent no text for this verse.')
  return text
}

export async function readEsvPassage(ids: string[]): Promise<{ id: string; text: string }[]> {
  const rows: { id: string; text: string }[] = []
  let index = 0
  while (index < ids.length && rows.length < CACHE_LIMIT) {
    const start = parseRef(ids[index])
    if (!start) {
      index += 1
      continue
    }
    let end = start.verse
    let nextIndex = index + 1
    while (nextIndex < ids.length && end - start.verse < 499) {
      const next = parseRef(ids[nextIndex])
      if (!next || next.book !== start.book || next.chapter !== start.chapter || next.verse !== end + 1) break
      end = next.verse
      nextIndex += 1
    }
    const verses = await passageVerses(start.book, start.chapter, start.verse, end)
    for (let verse = start.verse; verse <= end; verse += 1) {
      const text = verses[String(verse)]
      if (text) rows.push({ id: verseId(start.book, start.chapter, verse), text })
    }
    index = nextIndex
  }
  return rows
}

export async function searchEsv(query: string): Promise<{ id: string; text: string }[]> {
  const data = await esvSend<{ results?: { reference: string; content: string }[] }>('/v3/passage/search/', {
    q: query,
    'page-size': '40',
  })
  const hits: { id: string; text: string }[] = []
  for (const row of data.results ?? []) {
    const id = esvReferenceToId(row.reference)
    const text = row.content?.replace(/\s+/g, ' ').trim()
    if (!id || !text) continue
    hits.push({ id, text })
  }
  return hits
}
