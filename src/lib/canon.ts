export type Testament = 'OT' | 'NT'

export type Book = {
  id: string
  name: string
  chapters: number
  testament: Testament
}

export const BOOKS: Book[] = [
  { id: 'GEN', name: 'Genesis', chapters: 50, testament: 'OT' },
  { id: 'EXO', name: 'Exodus', chapters: 40, testament: 'OT' },
  { id: 'LEV', name: 'Leviticus', chapters: 27, testament: 'OT' },
  { id: 'NUM', name: 'Numbers', chapters: 36, testament: 'OT' },
  { id: 'DEU', name: 'Deuteronomy', chapters: 34, testament: 'OT' },
  { id: 'JOS', name: 'Joshua', chapters: 24, testament: 'OT' },
  { id: 'JDG', name: 'Judges', chapters: 21, testament: 'OT' },
  { id: 'RUT', name: 'Ruth', chapters: 4, testament: 'OT' },
  { id: '1SA', name: '1 Samuel', chapters: 31, testament: 'OT' },
  { id: '2SA', name: '2 Samuel', chapters: 24, testament: 'OT' },
  { id: '1KI', name: '1 Kings', chapters: 22, testament: 'OT' },
  { id: '2KI', name: '2 Kings', chapters: 25, testament: 'OT' },
  { id: '1CH', name: '1 Chronicles', chapters: 29, testament: 'OT' },
  { id: '2CH', name: '2 Chronicles', chapters: 36, testament: 'OT' },
  { id: 'EZR', name: 'Ezra', chapters: 10, testament: 'OT' },
  { id: 'NEH', name: 'Nehemiah', chapters: 13, testament: 'OT' },
  { id: 'EST', name: 'Esther', chapters: 10, testament: 'OT' },
  { id: 'JOB', name: 'Job', chapters: 42, testament: 'OT' },
  { id: 'PSA', name: 'Psalms', chapters: 150, testament: 'OT' },
  { id: 'PRO', name: 'Proverbs', chapters: 31, testament: 'OT' },
  { id: 'ECC', name: 'Ecclesiastes', chapters: 12, testament: 'OT' },
  { id: 'SNG', name: 'Song of Solomon', chapters: 8, testament: 'OT' },
  { id: 'ISA', name: 'Isaiah', chapters: 66, testament: 'OT' },
  { id: 'JER', name: 'Jeremiah', chapters: 52, testament: 'OT' },
  { id: 'LAM', name: 'Lamentations', chapters: 5, testament: 'OT' },
  { id: 'EZK', name: 'Ezekiel', chapters: 48, testament: 'OT' },
  { id: 'DAN', name: 'Daniel', chapters: 12, testament: 'OT' },
  { id: 'HOS', name: 'Hosea', chapters: 14, testament: 'OT' },
  { id: 'JOL', name: 'Joel', chapters: 3, testament: 'OT' },
  { id: 'AMO', name: 'Amos', chapters: 9, testament: 'OT' },
  { id: 'OBA', name: 'Obadiah', chapters: 1, testament: 'OT' },
  { id: 'JON', name: 'Jonah', chapters: 4, testament: 'OT' },
  { id: 'MIC', name: 'Micah', chapters: 7, testament: 'OT' },
  { id: 'NAM', name: 'Nahum', chapters: 3, testament: 'OT' },
  { id: 'HAB', name: 'Habakkuk', chapters: 3, testament: 'OT' },
  { id: 'ZEP', name: 'Zephaniah', chapters: 3, testament: 'OT' },
  { id: 'HAG', name: 'Haggai', chapters: 2, testament: 'OT' },
  { id: 'ZEC', name: 'Zechariah', chapters: 14, testament: 'OT' },
  { id: 'MAL', name: 'Malachi', chapters: 4, testament: 'OT' },
  { id: 'MAT', name: 'Matthew', chapters: 28, testament: 'NT' },
  { id: 'MRK', name: 'Mark', chapters: 16, testament: 'NT' },
  { id: 'LUK', name: 'Luke', chapters: 24, testament: 'NT' },
  { id: 'JHN', name: 'John', chapters: 21, testament: 'NT' },
  { id: 'ACT', name: 'Acts', chapters: 28, testament: 'NT' },
  { id: 'ROM', name: 'Romans', chapters: 16, testament: 'NT' },
  { id: '1CO', name: '1 Corinthians', chapters: 16, testament: 'NT' },
  { id: '2CO', name: '2 Corinthians', chapters: 13, testament: 'NT' },
  { id: 'GAL', name: 'Galatians', chapters: 6, testament: 'NT' },
  { id: 'EPH', name: 'Ephesians', chapters: 6, testament: 'NT' },
  { id: 'PHP', name: 'Philippians', chapters: 4, testament: 'NT' },
  { id: 'COL', name: 'Colossians', chapters: 4, testament: 'NT' },
  { id: '1TH', name: '1 Thessalonians', chapters: 5, testament: 'NT' },
  { id: '2TH', name: '2 Thessalonians', chapters: 3, testament: 'NT' },
  { id: '1TI', name: '1 Timothy', chapters: 6, testament: 'NT' },
  { id: '2TI', name: '2 Timothy', chapters: 4, testament: 'NT' },
  { id: 'TIT', name: 'Titus', chapters: 3, testament: 'NT' },
  { id: 'PHM', name: 'Philemon', chapters: 1, testament: 'NT' },
  { id: 'HEB', name: 'Hebrews', chapters: 13, testament: 'NT' },
  { id: 'JAS', name: 'James', chapters: 5, testament: 'NT' },
  { id: '1PE', name: '1 Peter', chapters: 5, testament: 'NT' },
  { id: '2PE', name: '2 Peter', chapters: 3, testament: 'NT' },
  { id: '1JN', name: '1 John', chapters: 5, testament: 'NT' },
  { id: '2JN', name: '2 John', chapters: 1, testament: 'NT' },
  { id: '3JN', name: '3 John', chapters: 1, testament: 'NT' },
  { id: 'JUD', name: 'Jude', chapters: 1, testament: 'NT' },
  { id: 'REV', name: 'Revelation', chapters: 22, testament: 'NT' },
]

export const SHELVES: { name: string; books: string[] }[] = [
  { name: 'Law', books: ['GEN', 'EXO', 'LEV', 'NUM', 'DEU'] },
  { name: 'History', books: ['JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST'] },
  { name: 'Writings', books: ['JOB', 'PSA', 'PRO', 'ECC', 'SNG'] },
  { name: 'Prophets', books: ['ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'] },
  { name: 'Gospels', books: ['MAT', 'MRK', 'LUK', 'JHN'] },
  { name: 'Acts', books: ['ACT'] },
  { name: 'Letters', books: ['ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD'] },
  { name: 'Revelation', books: ['REV'] },
]

const BY_ID = new Map(BOOKS.map((book) => [book.id, book]))

export function bookById(id: string): Book | undefined {
  return BY_ID.get(id)
}

export function bookName(id: string): string {
  return BY_ID.get(id)?.name ?? id
}

export type ChapterRef = { book: string; chapter: number }

export function allChapters(): ChapterRef[] {
  const list: ChapterRef[] = []
  for (const book of BOOKS) {
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
      list.push({ book: book.id, chapter })
    }
  }
  return list
}

export const CIRCUIT = allChapters()

export type ParsedRef = {
  book: string
  chapter: number
  verse: number
  end: number
}

export function parseRef(id: string): ParsedRef | null {
  const match = id.trim().toUpperCase().match(/^([0-9A-Z]+)\.(\d+)\.(\d+)(?:-(\d+))?$/)
  if (!match) return null
  const book = match[1]
  if (!BY_ID.has(book)) return null
  const chapter = Number(match[2])
  const start = Number(match[3])
  const end = match[4] ? Number(match[4]) : start
  if (!chapter || !start) return null
  return { book, chapter, verse: start, end: Math.max(start, end) }
}

export function verseId(book: string, chapter: number, verse: number, end?: number): string {
  if (end && end > verse) return `${book}.${chapter}.${verse}-${end}`
  return `${book}.${chapter}.${verse}`
}

export function expandRef(id: string, cap = 8): string[] {
  const parsed = parseRef(id)
  if (!parsed) return []
  const last = Math.min(parsed.end, parsed.verse + cap - 1)
  const ids: string[] = []
  for (let verse = parsed.verse; verse <= last; verse += 1) {
    ids.push(verseId(parsed.book, parsed.chapter, verse))
  }
  return ids
}

export function formatRef(id: string): string {
  const parsed = parseRef(id)
  if (!parsed) return id
  const name = bookName(parsed.book)
  const verses = parsed.end > parsed.verse ? `${parsed.verse}–${parsed.end}` : String(parsed.verse)
  return `${name} ${parsed.chapter}:${verses}`
}

export function shortRef(id: string): string {
  const parsed = parseRef(id)
  if (!parsed) return id
  const short: Record<string, string> = {
    GEN: 'Ge', EXO: 'Ex', LEV: 'Le', NUM: 'Nu', DEU: 'Dt', JOS: 'Jos', JDG: 'Jdg', RUT: 'Ru',
    '1SA': '1Sa', '2SA': '2Sa', '1KI': '1Ki', '2KI': '2Ki', '1CH': '1Ch', '2CH': '2Ch',
    EZR: 'Ezr', NEH: 'Ne', EST: 'Est', JOB: 'Job', PSA: 'Ps', PRO: 'Pr', ECC: 'Ec', SNG: 'So',
    ISA: 'Is', JER: 'Je', LAM: 'La', EZK: 'Eze', DAN: 'Da', HOS: 'Ho', JOL: 'Joe', AMO: 'Am',
    OBA: 'Ob', JON: 'Jon', MIC: 'Mic', NAM: 'Na', HAB: 'Hab', ZEP: 'Zep', HAG: 'Hag', ZEC: 'Zec', MAL: 'Mal',
    MAT: 'Mt', MRK: 'Mk', LUK: 'Lk', JHN: 'Jn', ACT: 'Ac', ROM: 'Ro', '1CO': '1Co', '2CO': '2Co',
    GAL: 'Ga', EPH: 'Eph', PHP: 'Php', COL: 'Col', '1TH': '1Th', '2TH': '2Th', '1TI': '1Ti', '2TI': '2Ti',
    TIT: 'Tit', PHM: 'Phm', HEB: 'Heb', JAS: 'Jas', '1PE': '1Pe', '2PE': '2Pe', '1JN': '1Jn', '2JN': '2Jn',
    '3JN': '3Jn', JUD: 'Jud', REV: 'Re',
  }
  const verses = parsed.end > parsed.verse ? `${parsed.verse}–${parsed.end}` : String(parsed.verse)
  return `${short[parsed.book] ?? parsed.book} ${parsed.chapter}:${verses}`
}

const EXTRA_BOOKS: Array<[string, string]> = [
  ['psalm', 'PSA'],
  ['psalms', 'PSA'],
  ['song of songs', 'SNG'],
  ['rev', 'REV'],
  ['gen', 'GEN'],
  ['exo', 'EXO'],
  ['matt', 'MAT'],
  ['mk', 'MRK'],
  ['lk', 'LUK'],
  ['joh', 'JHN'],
  ['1 cor', '1CO'],
  ['2 cor', '2CO'],
  ['1 sam', '1SA'],
  ['2 sam', '2SA'],
  ['1 kgs', '1KI'],
  ['2 kgs', '2KI'],
  ['1 chr', '1CH'],
  ['2 chr', '2CH'],
  ['1 thess', '1TH'],
  ['2 thess', '2TH'],
  ['1 tim', '1TI'],
  ['2 tim', '2TI'],
  ['1 pet', '1PE'],
  ['2 pet', '2PE'],
]

const BOOK_ALIASES = (() => {
  const shorts: Record<string, string> = {
    GEN: 'Ge', EXO: 'Ex', LEV: 'Le', NUM: 'Nu', DEU: 'Dt', JOS: 'Jos', JDG: 'Jdg', RUT: 'Ru',
    '1SA': '1Sa', '2SA': '2Sa', '1KI': '1Ki', '2KI': '2Ki', '1CH': '1Ch', '2CH': '2Ch',
    EZR: 'Ezr', NEH: 'Ne', EST: 'Est', JOB: 'Job', PSA: 'Ps', PRO: 'Pr', ECC: 'Ec', SNG: 'So',
    ISA: 'Is', JER: 'Je', LAM: 'La', EZK: 'Eze', DAN: 'Da', HOS: 'Ho', JOL: 'Joe', AMO: 'Am',
    OBA: 'Ob', JON: 'Jon', MIC: 'Mic', NAM: 'Na', HAB: 'Hab', ZEP: 'Zep', HAG: 'Hag', ZEC: 'Zec', MAL: 'Mal',
    MAT: 'Mt', MRK: 'Mk', LUK: 'Lk', JHN: 'Jn', ACT: 'Ac', ROM: 'Ro', '1CO': '1Co', '2CO': '2Co',
    GAL: 'Ga', EPH: 'Eph', PHP: 'Php', COL: 'Col', '1TH': '1Th', '2TH': '2Th', '1TI': '1Ti', '2TI': '2Ti',
    TIT: 'Tit', PHM: 'Phm', HEB: 'Heb', JAS: 'Jas', '1PE': '1Pe', '2PE': '2Pe', '1JN': '1Jn', '2JN': '2Jn',
    '3JN': '3Jn', JUD: 'Jud', REV: 'Re',
  }
  const list: Array<{ alias: string; id: string }> = []
  for (const book of BOOKS) {
    list.push({ alias: book.name.toLowerCase(), id: book.id })
    list.push({ alias: book.id.toLowerCase(), id: book.id })
    const short = shorts[book.id]
    if (short) list.push({ alias: short.toLowerCase(), id: book.id })
  }
  for (const [alias, id] of EXTRA_BOOKS) list.push({ alias, id })
  const seen = new Set<string>()
  return list
    .sort((a, b) => b.alias.length - a.alias.length)
    .filter((item) => {
      const key = `${item.alias}:${item.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
})()

export function parseSpokenRef(input: string): ParsedRef | null {
  const cleaned = input.trim().replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ')
  if (!cleaned) return null
  const direct = parseRef(cleaned.replace(/:/g, '.').replace(/\s+/g, ''))
  if (direct) return direct
  const lower = cleaned.toLowerCase()
  for (const item of BOOK_ALIASES) {
    if (!lower.startsWith(item.alias)) continue
    const rest = lower.slice(item.alias.length)
    if (rest && !/^[\s.:]/.test(rest)) continue
    const book = bookById(item.id)
    if (!book) continue
    const tail = rest.replace(/^[\s.:]+/, '')
    const match = tail.match(/^(\d+)(?:[:.](\d+)(?:-(\d+))?)?$/)
    if (!match) continue
    const chapter = Number(match[1])
    if (chapter < 1 || chapter > book.chapters) return null
    const verse = match[2] ? Number(match[2]) : 1
    const end = match[3] ? Number(match[3]) : verse
    if (verse < 1 || verse > 176 || end < verse || end > 176) return null
    return { book: book.id, chapter, verse, end }
  }
  return null
}

export function neighbor(book: string, chapter: number, step: -1 | 1): ChapterRef | null {
  const index = CIRCUIT.findIndex((item) => item.book === book && item.chapter === chapter)
  if (index < 0) return null
  return CIRCUIT[index + step] ?? null
}
