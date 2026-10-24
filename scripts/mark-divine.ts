import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from '../src/lib/canon'
import { markDivine, unionRanges, type Range } from '../src/lib/divine'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const out = join(root, 'public', 'data', 'divine')

const NAME_TO_ID = new Map(BOOKS.flatMap((book) => {
  const aliases = [book.name]
  if (book.name === 'Psalms') aliases.push('Psalm')
  if (book.name === 'Song of Solomon') aliases.push('Song of Songs', 'Canticles', 'The Song of Solomon')
  if (book.name === 'Revelation') aliases.push('The Revelation', 'Revelation of John', 'The Apocalypse')
  return aliases.map((alias) => [alias.toLowerCase(), book.id])
}))
for (const [alias, id] of [
  ['i samuel', '1SA'], ['ii samuel', '2SA'], ['i kings', '1KI'], ['ii kings', '2KI'],
  ['i chronicles', '1CH'], ['ii chronicles', '2CH'], ['i corinthians', '1CO'], ['ii corinthians', '2CO'],
  ['i thessalonians', '1TH'], ['ii thessalonians', '2TH'], ['i timothy', '1TI'], ['ii timothy', '2TI'],
  ['i peter', '1PE'], ['ii peter', '2PE'], ['i john', '1JN'], ['ii john', '2JN'], ['iii john', '3JN'],
] as const) NAME_TO_ID.set(alias, id)

const USFM_TO_ID = new Map(BOOKS.map((book) => [book.id, book.id]))
for (const [from, to] of [['EZE', 'EZK'], ['NAH', 'NAM'], ['SOS', 'SNG'], ['SOL', 'SNG'], ['JOH', 'JHN'], ['PSM', 'PSA']] as const) {
  USFM_TO_ID.set(from, to)
}

type Chapter = Record<string, string>
type BookText = Record<string, Chapter>

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function readJson(path: string): { chapters: Record<string, Record<string, string | [string, string?][]>> } {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function loadPlain(translation: 'kjv' | 'web'): Record<string, BookText> {
  const books: Record<string, BookText> = {}
  for (const book of BOOKS) {
    const file = readJson(join(root, 'public', 'data', 'text', translation, `${book.id}.json`))
    const chapters: BookText = {}
    for (const [chapter, verses] of Object.entries(file.chapters)) {
      const plain: Chapter = {}
      for (const [verse, value] of Object.entries(verses)) {
        plain[verse] = typeof value === 'string' ? value : value.map((token) => token[0]).join('')
      }
      chapters[chapter] = plain
    }
    books[book.id] = chapters
  }
  return books
}

function rangesFromFlags(flags: boolean[]): Range[] {
  const ranges: Range[] = []
  let start = -1
  for (let index = 0; index <= flags.length; index += 1) {
    if (flags[index] && start < 0) start = index
    if (!flags[index] && start >= 0) {
      ranges.push([start, index])
      start = -1
    }
  }
  return ranges
}

function collapse(text: string, flags: boolean[]): { text: string; ranges: Range[] } {
  let out = ''
  const god: boolean[] = []
  let index = 0
  while (index < text.length && /\s/.test(text[index])) index += 1
  while (index < text.length) {
    if (/\s/.test(text[index])) {
      let next = index
      while (next < text.length && /\s/.test(text[next])) next += 1
      if (next >= text.length) break
      out += ' '
      god.push(false)
      index = next
      continue
    }
    out += text[index]
    god.push(Boolean(flags[index]))
    index += 1
  }
  return { text: out, ranges: rangesFromFlags(god) }
}

function jesusFromOsis(raw: string): { text: string; ranges: Range[] } {
  let source = decode(raw)
    .replace(/<note[\s\S]*?<\/note>/gi, '')
    .replace(/<lb\s*\/?>/gi, '\n')
    .replace(/<w\b[^>]*\/>/gi, '')
  let text = ''
  const flags: boolean[] = []
  let depth = 0
  let index = 0
  while (index < source.length) {
    if (source[index] !== '<') {
      text += source[index]
      flags.push(depth > 0)
      index += 1
      continue
    }
    const end = source.indexOf('>', index)
    if (end < 0) break
    const tag = source.slice(index, end + 1)
    if (/^<q\b/i.test(tag) && /who="Jesus"/.test(tag)) depth += 1
    else if (/^<\/q>/i.test(tag)) depth = Math.max(0, depth - 1)
    index = end + 1
  }
  return { text, ranges: rangesFromFlags(flags) }
}

function kjvJesusAligned(plain: Record<string, BookText>): { ranges: Record<string, BookTextRanges>; misses: number } {
  const data = JSON.parse(readFileSync(join(root, 'data-cache', 'KJV-osis.json'), 'utf8'))
  const ranges: Record<string, BookTextRanges> = {}
  let misses = 0
  for (const book of data.books ?? data) {
    const id = NAME_TO_ID.get(String(book.name ?? '').trim().toLowerCase())
    if (!id || !plain[id]) continue
    const chapters: BookTextRanges = {}
    for (const chapter of book.chapters ?? []) {
      for (const verse of chapter.verses ?? []) {
        const marked = jesusFromOsis(String(verse.text ?? ''))
        const stored = plain[id][String(chapter.chapter)]?.[String(verse.verse)]
        if (stored == null) continue
        if (stored !== marked.text) {
          misses += 1
          if (misses <= 6) console.log('kjv mismatch', `${id} ${chapter.chapter}:${verse.verse}`, JSON.stringify(stored.slice(0, 80)), JSON.stringify(marked.text.slice(0, 80)))
          continue
        }
        if (!marked.ranges.length) continue
        const slot = chapters[String(chapter.chapter)] ?? (chapters[String(chapter.chapter)] = {})
        slot[String(verse.verse)] = marked.ranges
      }
    }
    ranges[id] = chapters
  }
  return { ranges, misses }
}

type BookTextRanges = Record<string, Record<string, Range[]>>

function webJesus(plain: Record<string, BookText>): { ranges: Record<string, BookTextRanges>; misses: number } {
  const ranges: Record<string, BookTextRanges> = {}
  let misses = 0
  const dir = join(root, 'data-cache', 'web')
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.usfm')) continue
    const src = readFileSync(join(dir, name), 'utf8').replace(/^\uFEFF/, '')
    const code = src.match(/\\id\s+([A-Z0-9]{2,4})/)?.[1]
    const id = code ? USFM_TO_ID.get(code) : undefined
    if (!id || !plain[id]) continue
    const chapters: BookTextRanges = {}
    let chapter = 0
    let verse = 0
    let buf = ''
    let pending = ''
    let depth = 0
    const close = () => {
      if (!chapter || !verse) return
      const marked = webVerse(buf, depth)
      depth = marked.depth
      const stored = plain[id][String(chapter)]?.[String(verse)]
      if (stored == null) {
        buf = ''
        return
      }
      if (stored !== marked.text) {
        misses += 1
        if (misses <= 8) console.log('web mismatch', `${id} ${chapter}:${verse}`, JSON.stringify(stored.slice(0, 90)), JSON.stringify(marked.text.slice(0, 90)))
      } else if (marked.ranges.length) {
        const slot = chapters[String(chapter)] ?? (chapters[String(chapter)] = {})
        slot[String(verse)] = marked.ranges
      }
      buf = ''
    }
    for (const line of src.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const chapterMatch = trimmed.match(/^\\c\s+(\d+)/)
      if (chapterMatch) {
        close()
        chapter = Number(chapterMatch[1])
        verse = 0
        continue
      }
      const verseMatch = trimmed.match(/^\\v\s+(\d+)(?:-\d+)?\s*(.*)$/)
      if (verseMatch) {
        close()
        verse = Number(verseMatch[1])
        buf = pending ? `${pending} ${verseMatch[2]}` : verseMatch[2]
        pending = ''
        continue
      }
      const desc = trimmed.match(/^\\d\s+(.*)$/)
      if (desc) {
        pending = `${pending} ${desc[1]}`.trim()
        continue
      }
      if (/^\\(id|h|toc\d?|mt\d?|ms\d?|s\d?|r|sp|ip|is\d?|iq\d?|ili\d?|io\d?|imt\d?|cl|cp|ca|rem|sts|ide)\b/.test(trimmed)) continue
      if (verse) buf += ` ${trimmed}`
    }
    close()
    ranges[id] = chapters
  }
  return { ranges, misses }
}

function webVerse(raw: string, depth: number): { text: string; ranges: Range[]; depth: number } {
  let source = raw
    .replace(/\\f[\s+][\s\S]*?\\f\*/g, ' ')
    .replace(/\\fe[\s+][\s\S]*?\\fe\*/g, ' ')
    .replace(/\\x[\s+][\s\S]*?\\x\*/g, ' ')
    .replace(/\\fig[\s\S]*?\\fig\*/g, ' ')
    .replace(/\|[^\s\\]*/g, '')
  let text = ''
  const flags: boolean[] = []
  let index = 0
  while (index < source.length) {
    if (source[index] !== '\\') {
      text += source[index]
      flags.push(depth > 0)
      index += 1
      continue
    }
    const marker = source.slice(index).match(/^\\[+]?(wj)\*?|^\\[+]?\w+\*?/)
    if (!marker) {
      text += source[index]
      flags.push(depth > 0)
      index += 1
      continue
    }
    if (marker[1]) {
      if (marker[0].endsWith('*')) depth = Math.max(0, depth - 1)
      else depth += 1
    }
    index += marker[0].length
  }
  const collapsed = collapse(text, flags)
  return { text: collapsed.text, ranges: collapsed.ranges, depth }
}

function joinWords(text: string, ranges: Range[]): Range[] {
  const outRanges: Range[] = []
  for (const range of ranges) {
    const last = outRanges[outRanges.length - 1]
    if (last && text.slice(last[1], range[0]).trim() === '') last[1] = range[1]
    else outRanges.push([range[0], range[1]])
  }
  return outRanges
}

function ordered(chapters: Chapter): { keys: string[]; texts: string[] } {
  const keys = Object.keys(chapters).sort((a, b) => Number(a) - Number(b))
  return { keys, texts: keys.map((key) => chapters[key]) }
}

function writeBooks(translation: 'kjv' | 'web', plain: Record<string, BookText>, extra: Record<string, BookTextRanges>) {
  const dir = join(out, translation)
  mkdirSync(dir, { recursive: true })
  for (const book of BOOKS) {
    const chapters = plain[book.id]
    const file: BookTextRanges = {}
    if (!chapters) continue
    for (const [chapter, verses] of Object.entries(chapters)) {
      const { keys, texts } = ordered(verses)
      const spoken = markDivine(texts)
      const slot: Record<string, Range[]> = {}
      keys.forEach((verse, index) => {
        const ranges = joinWords(texts[index], unionRanges([spoken[index] ?? [], extra[book.id]?.[chapter]?.[verse] ?? []]))
        if (ranges.length) slot[verse] = ranges
      })
      if (Object.keys(slot).length) file[chapter] = slot
    }
    writeFileSync(join(dir, `${book.id}.json`), JSON.stringify(file))
  }
}

function verse(plain: Record<string, BookText>, id: string, chapter: string, verseNo: string): string {
  return plain[id]?.[chapter]?.[verseNo] ?? ''
}

function rangesOf(translation: 'kjv' | 'web', id: string, chapter: string, verseNo: string): Range[] {
  const file = JSON.parse(readFileSync(join(out, translation, `${id}.json`), 'utf8')) as BookTextRanges
  return file[chapter]?.[verseNo] ?? []
}

function bracket(text: string, ranges: Range[]): string {
  let outText = ''
  let cursor = 0
  for (const [start, end] of ranges) {
    outText += `${text.slice(cursor, start)}«${text.slice(start, end)}»`
    cursor = end
  }
  return outText + text.slice(cursor)
}

function expectMarked(label: string, text: string, ranges: Range[], snippet: string, marked: boolean): boolean {
  const at = text.indexOf(snippet)
  if (at < 0) {
    console.log('FAIL', label, 'missing', snippet)
    return false
  }
  const mid = at + Math.min(2, snippet.length - 1)
  const hit = ranges.some(([start, end]) => mid >= start && mid < end)
  if (hit !== marked) {
    console.log('FAIL', label, marked ? 'expected red' : 'expected plain', snippet)
    console.log(bracket(text, ranges))
    return false
  }
  return true
}

function check(plainKjv: Record<string, BookText>, plainWeb: Record<string, BookText>) {
  const cases: [string, 'kjv' | 'web', string, string, string, string, boolean][] = [
    ['kjv light', 'kjv', 'GEN', '1', '3', 'Let there be light', true],
    ['kjv light narrative', 'kjv', 'GEN', '1', '3', 'there was light', false],
    ['kjv creation', 'kjv', 'GEN', '1', '1', 'In the beginning', false],
    ['kjv beloved', 'kjv', 'MAT', '3', '17', 'beloved Son', true],
    ['kjv blessed', 'kjv', 'MAT', '5', '3', 'Blessed', true],
    ['kjv loved', 'kjv', 'JHN', '3', '16', 'God so loved', true],
    ['kjv nicodemus', 'kjv', 'JHN', '3', '1', 'There was a man', false],
    ['kjv holy ground', 'kjv', 'EXO', '3', '5', 'Draw not nigh', true],
    ['kjv fear not', 'kjv', 'ISA', '43', '1', 'Fear not', true],
    ['kjv adam', 'kjv', 'GEN', '3', '10', 'I heard thy voice', false],
    ['kjv commandment', 'kjv', 'EXO', '20', '3', 'no other gods', true],
    ['web light', 'web', 'GEN', '1', '3', 'Let there be light', true],
    ['web light narrative', 'web', 'GEN', '1', '3', 'there was light', false],
    ['web looking', 'web', 'JHN', '1', '38', 'looking for', true],
    ['web beloved', 'web', 'MAT', '3', '17', 'beloved Son', true],
  ]
  let ok = true
  for (const [label, translation, id, chapter, verseNo, snippet, marked] of cases) {
    const text = verse(translation === 'kjv' ? plainKjv : plainWeb, id, chapter, verseNo)
    const ranges = rangesOf(translation, id, chapter, verseNo)
    ok = expectMarked(label, text, ranges, snippet, marked) && ok
  }
  const samples: ['kjv' | 'web', string, string, string][] = [
    ['kjv', 'GEN', '1', '3'],
    ['kjv', 'GEN', '1', '28'],
    ['kjv', 'EXO', '3', '14'],
    ['kjv', 'EXO', '3', '5'],
    ['kjv', 'ISA', '43', '1'],
    ['kjv', 'MAT', '5', '3'],
    ['web', 'GEN', '1', '3'],
    ['web', 'EXO', '3', '14'],
    ['web', 'JHN', '3', '16'],
    ['web', 'MAT', '5', '3'],
  ]
  for (const [translation, id, chapter, verseNo] of samples) {
    const text = verse(translation === 'kjv' ? plainKjv : plainWeb, id, chapter, verseNo)
    console.log(`\n${translation} ${id} ${chapter}:${verseNo}`)
    console.log(bracket(text, rangesOf(translation, id, chapter, verseNo)))
  }
  if (!ok) process.exitCode = 1
}

const plainKjv = loadPlain('kjv')
const plainWeb = loadPlain('web')
const jesus = kjvJesusAligned(plainKjv)
const words = webJesus(plainWeb)
console.log('kjv jesus misses', jesus.misses, 'web wj misses', words.misses)
writeBooks('kjv', plainKjv, jesus.ranges)
writeBooks('web', plainWeb, words.ranges)
check(plainKjv, plainWeb)
