import { BOOKS, bookById, expandRef, parseRef, verseId } from './canon'
import { EsvError, loadEsvChapter, readEsvPassage, readEsvVerse, searchEsv } from './esv'

export type Translation = 'kjv' | 'web' | 'esv'

export function translationShort(translation: Translation): string {
  if (translation === 'web') return 'WEB'
  if (translation === 'esv') return 'ESV'
  return 'KJV'
}

export function translationName(translation: Translation): string {
  if (translation === 'web') return 'World English Bible'
  if (translation === 'esv') return 'English Standard Version'
  return 'King James Version'
}

export type Token = [string] | [string, string]
export type Verse = string | Token[]
export type BookFile = { chapters: Record<string, Record<string, Verse>> }
export type XRefGroup = { p: string; v: string[] }
export type XRefFile = Record<string, XRefGroup[]>
export type Gloss = { g: string; l?: string; x?: string; p?: string; d?: string; r?: string }
export type OriginalWord = { w: string; m: string; s?: string }
export type OriginalBook = { chapters: Record<string, Record<string, OriginalWord[]>> }

const books = new Map<string, Promise<BookFile>>()
const xrefs = new Map<string, Promise<XRefFile>>()
let glossPromise: Promise<Record<string, Gloss>> | null = null
const concord = new Map<string, Promise<Record<string, { n: number; v: string[] }>>>()
const strongs = new Map<string, Promise<Record<string, string[]>>>()
const originals = new Map<string, Promise<OriginalBook>>()
const searchCache = new Map<Translation, Promise<{ id: string; text: string }[]>>()

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Missing ${path}`)
  return response.json() as Promise<T>
}

export function loadChapter(translation: Translation, book: string, chapter: number): Promise<BookFile> {
  if (translation === 'esv') return loadEsvChapter(book, chapter)
  return loadBook(translation, book)
}

export function loadBook(translation: Translation, book: string): Promise<BookFile> {
  if (translation === 'esv') return Promise.reject(new EsvError('network', 'ESV is read one chapter at a time from Crossway.'))
  const key = `${translation}/${book}`
  let pending = books.get(key)
  if (!pending) {
    pending = fetchJson<BookFile>(`/data/text/${translation}/${book}.json`)
    books.set(key, pending)
  }
  return pending
}

export function loadXrefs(book: string): Promise<XRefFile> {
  let pending = xrefs.get(book)
  if (!pending) {
    pending = fetchJson<XRefFile>(`/data/xrefs/${book}.json`).catch(() => ({}))
    xrefs.set(book, pending)
  }
  return pending
}

export function loadOriginal(book: string): Promise<OriginalBook> {
  let pending = originals.get(book)
  if (!pending) {
    pending = fetchJson<OriginalBook>(`/data/original/${book}.json`).catch(() => ({ chapters: {} }))
    originals.set(book, pending)
  }
  return pending
}

export function loadGloss(): Promise<Record<string, Gloss>> {
  if (!glossPromise) glossPromise = fetchJson<Record<string, Gloss>>('/data/gloss.json')
  return glossPromise
}

export function plain(verse: Verse | undefined): string {
  if (!verse) return ''
  if (typeof verse === 'string') return verse
  return verse.map((token) => token[0]).join('')
}

export function verseKey(chapter: number, verse: number): string {
  return `${chapter}:${verse}`
}

export async function readVerse(prefer: Translation, id: string): Promise<{ text: string; translation: Translation; id: string } | null> {
  const parsed = parseRef(id)
  if (!parsed) return null
  const order: Translation[] = prefer === 'esv' ? ['esv', 'kjv', 'web'] : prefer === 'web' ? ['web', 'kjv'] : ['kjv', 'web']
  for (const translation of order) {
    try {
      if (translation === 'esv') {
        const text = await readEsvVerse(verseId(parsed.book, parsed.chapter, parsed.verse))
        if (text) return { text, translation, id: verseId(parsed.book, parsed.chapter, parsed.verse) }
        continue
      }
      const book = await loadBook(translation, parsed.book)
      const text = plain(book.chapters[String(parsed.chapter)]?.[String(parsed.verse)])
      if (text) return { text, translation, id: verseId(parsed.book, parsed.chapter, parsed.verse) }
    } catch {
      /* try the other edition */
    }
  }
  return null
}

export async function readPassage(prefer: Translation, id: string): Promise<{ id: string; text: string; translation: Translation }[]> {
  const ids = expandRef(id)
  if (prefer === 'esv') {
    try {
      const esv = await readEsvPassage(ids)
      if (esv.length) return esv.map((row) => ({ ...row, translation: 'esv' as const }))
    } catch {
      /* the local editions still answer */
    }
  }
  const fallback: Translation = prefer === 'esv' ? 'kjv' : prefer
  const rows = await Promise.all(ids.map((item) => readVerse(fallback, item)))
  return rows.filter((row): row is { id: string; text: string; translation: Translation } => Boolean(row))
}

export function strongShard(id: string): string {
  const match = id.match(/^([HG])(\d+)$/)
  if (!match) return 'H0'
  const n = Number(match[2])
  const bucket = n < 1000 ? 0 : Math.floor(n / 1000)
  return `${match[1]}${bucket}`
}

export function loadStrongShard(id: string): Promise<Record<string, string[]>> {
  const shard = strongShard(id)
  let pending = strongs.get(shard)
  if (!pending) {
    pending = fetchJson<Record<string, string[]>>(`/data/strongs/${shard}.json`).catch(() => ({}))
    strongs.set(shard, pending)
  }
  return pending
}

export function loadConcord(letter: string): Promise<Record<string, { n: number; v: string[] }>> {
  const key = letter.toLowerCase().replace(/[^a-z]/g, '') || 'a'
  let pending = concord.get(key)
  if (!pending) {
    pending = fetchJson<Record<string, { n: number; v: string[] }>>(`/data/concord/${key}.json`).catch(() => ({}))
    concord.set(key, pending)
  }
  return pending
}

export async function searchCanon(translation: Translation, query: string): Promise<{ id: string; text: string }[]> {
  const needle = query.trim()
  if (needle.length < 2) return []
  if (translation === 'esv') return searchEsv(needle)
  const folded = needle.toLowerCase()
  let index = searchCache.get(translation)
  if (!index) {
    index = Promise.all(
      BOOKS.map(async (book) => {
        const file = await loadBook(translation, book.id)
        const rows: { id: string; text: string }[] = []
        for (const [chapter, verses] of Object.entries(file.chapters)) {
          for (const [verse, value] of Object.entries(verses)) {
            const text = plain(value)
            if (text) rows.push({ id: verseId(book.id, Number(chapter), Number(verse)), text })
          }
        }
        return rows
      }),
    ).then((groups) => groups.flat())
    searchCache.set(translation, index)
  }
  const rows = await index
  const hits: { id: string; text: string }[] = []
  for (const row of rows) {
    if (row.text.toLowerCase().includes(folded)) {
      hits.push(row)
      if (hits.length >= 60) break
    }
  }
  return hits
}

export function knownBook(id: string): boolean {
  return Boolean(bookById(id))
}
