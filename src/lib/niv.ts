import { bookById, parseRef, verseId } from './canon'

const BIBLE_ID = '78a9f6124f344018-01'
const CACHE_LIMIT = 12

const chapters = new Map<string, { verses: Record<string, string>; fums: string }>()
const inflight = new Map<string, Promise<{ verses: Record<string, string>; fums: string }>>()

const chapterParams: Record<string, string> = {
  'content-type': 'text',
  'include-notes': 'false',
  'include-titles': 'false',
  'include-chapter-numbers': 'false',
  'include-verse-numbers': 'true',
  'include-verse-spans': 'false',
  'fums-version': '3',
}

export class NivError extends Error {
  reason: 'key' | 'denied' | 'limit' | 'network'

  constructor(reason: 'key' | 'denied' | 'limit' | 'network', message: string) {
    super(message)
    this.name = 'NivError'
    this.reason = reason
  }
}

function anonId(store: Storage, key: string): string {
  try {
    const existing = store.getItem(key)
    if (existing) return existing
    const next = crypto.randomUUID()
    store.setItem(key, next)
    return next
  } catch {
    return 'anon'
  }
}

function reportFums(token: string): void {
  if (!token) return
  let device = 'anon'
  let session = 'anon'
  try {
    device = anonId(localStorage, 'scripture.fums.device')
    session = anonId(sessionStorage, 'scripture.fums.session')
  } catch {
    /* private mode */
  }
  const url = `https://fums.api.bible/f3?t=${encodeURIComponent(token)}&dId=${encodeURIComponent(device)}&sId=${encodeURIComponent(session)}`
  fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(() => undefined)
}

export function parseNivChapter(passage: string): Record<string, string> {
  const marks: { verse: number; index: number; length: number }[] = []
  const re = /\[(\d+)\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(passage))) {
    marks.push({ verse: Number(match[1]), index: match.index, length: match[0].length })
  }
  const verses: Record<string, string> = {}
  for (let index = 0; index < marks.length; index += 1) {
    const start = marks[index].index + marks[index].length
    const end = index + 1 < marks.length ? marks[index + 1].index : passage.length
    const text = passage.slice(start, end).replace(/\s+/g, ' ').trim()
    if (text) verses[String(marks[index].verse)] = text
  }
  return verses
}

function remember(key: string, value: { verses: Record<string, string>; fums: string }): void {
  if (chapters.has(key)) chapters.delete(key)
  chapters.set(key, value)
  while (chapters.size > CACHE_LIMIT) {
    const oldest = chapters.keys().next().value
    if (!oldest) break
    chapters.delete(oldest)
  }
}

async function nivSend<T>(path: string, params: Record<string, string>): Promise<{ data: T; fums: string }> {
  const query = new URLSearchParams({ ...params, 'fums-version': '3' })
  const response = await fetch(`/bible-api${path}?${query}`)
  const raw = await response.text()
  let body: { data?: T; meta?: { fumsToken?: string }; error?: string } | null = null
  try {
    body = JSON.parse(raw) as { data?: T; meta?: { fumsToken?: string }; error?: string }
  } catch {
    body = null
  }
  if (response.status === 401 || response.status === 403) {
    throw new NivError('denied', 'API.Bible did not accept the NIV key on this server.')
  }
  if (response.status === 429) {
    throw new NivError('limit', 'API.Bible is limiting requests for a while. Wait and open the chapter again.')
  }
  if (!body?.data || response.status < 200 || response.status >= 300) {
    throw new NivError('network', body?.error || 'The NIV text did not load. Try the chapter again.')
  }
  return { data: body.data, fums: body.meta?.fumsToken ?? '' }
}

async function chapterVerses(bookId: string, chapter: number): Promise<Record<string, string>> {
  const book = bookById(bookId)
  if (!book || chapter < 1 || chapter > book.chapters) throw new NivError('network', 'That chapter is not in the canon.')
  const key = `${bookId}.${chapter}`
  const cached = chapters.get(key)
  if (cached) {
    remember(key, cached)
    reportFums(cached.fums)
    return cached.verses
  }
  const pending = inflight.get(key)
  if (pending) {
    const ready = await pending
    reportFums(ready.fums)
    return ready.verses
  }
  const request = nivSend<{ content?: string }>(`/v1/bibles/${BIBLE_ID}/chapters/${bookId}.${chapter}`, chapterParams)
    .then((payload) => {
      const verses = parseNivChapter(payload.data.content ?? '')
      if (!Object.keys(verses).length) throw new NivError('network', 'API.Bible sent no text for this chapter.')
      const value = { verses, fums: payload.fums }
      remember(key, value)
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, request)
  const ready = await request
  reportFums(ready.fums)
  return ready.verses
}

export async function loadNivChapter(bookId: string, chapter: number): Promise<{ chapters: Record<string, Record<string, string>> }> {
  const verses = await chapterVerses(bookId, chapter)
  return { chapters: { [String(chapter)]: verses } }
}

export async function readNivVerse(id: string): Promise<string> {
  const parsed = parseRef(id)
  if (!parsed) throw new NivError('network', 'That verse is not in the canon.')
  const verses = await chapterVerses(parsed.book, parsed.chapter)
  const text = verses[String(parsed.verse)]
  if (!text) throw new NivError('network', 'API.Bible sent no text for this verse.')
  return text
}

export async function readNivPassage(ids: string[]): Promise<{ id: string; text: string }[]> {
  const rows: { id: string; text: string }[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (rows.length >= 500) break
    const parsed = parseRef(id)
    if (!parsed) continue
    const verses = await chapterVerses(parsed.book, parsed.chapter)
    for (let verse = parsed.verse; verse <= parsed.end; verse += 1) {
      if (rows.length >= 500) break
      const key = verseId(parsed.book, parsed.chapter, verse)
      if (seen.has(key)) continue
      const text = verses[String(verse)]
      if (!text) continue
      seen.add(key)
      rows.push({ id: key, text })
    }
  }
  return rows
}

export async function searchNiv(query: string): Promise<{ id: string; text: string }[]> {
  const payload = await nivSend<{ verses?: { id?: string; text?: string }[] }>(`/v1/bibles/${BIBLE_ID}/search`, {
    query,
    limit: '40',
  })
  reportFums(payload.fums)
  const hits: { id: string; text: string }[] = []
  for (const row of payload.data.verses ?? []) {
    const id = row.id ?? ''
    if (!parseRef(id)) continue
    const text = (row.text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!text) continue
    hits.push({ id, text })
  }
  return hits
}
