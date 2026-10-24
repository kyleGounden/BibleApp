import { execFileSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cache = join(root, 'data-cache')
const out = join(root, 'public', 'data')

const BOOKS = [
  ['GEN', 'Genesis', 50, 'OT'], ['EXO', 'Exodus', 40, 'OT'], ['LEV', 'Leviticus', 27, 'OT'],
  ['NUM', 'Numbers', 36, 'OT'], ['DEU', 'Deuteronomy', 34, 'OT'], ['JOS', 'Joshua', 24, 'OT'],
  ['JDG', 'Judges', 21, 'OT'], ['RUT', 'Ruth', 4, 'OT'], ['1SA', '1 Samuel', 31, 'OT'],
  ['2SA', '2 Samuel', 24, 'OT'], ['1KI', '1 Kings', 22, 'OT'], ['2KI', '2 Kings', 25, 'OT'],
  ['1CH', '1 Chronicles', 29, 'OT'], ['2CH', '2 Chronicles', 36, 'OT'], ['EZR', 'Ezra', 10, 'OT'],
  ['NEH', 'Nehemiah', 13, 'OT'], ['EST', 'Esther', 10, 'OT'], ['JOB', 'Job', 42, 'OT'],
  ['PSA', 'Psalms', 150, 'OT'], ['PRO', 'Proverbs', 31, 'OT'], ['ECC', 'Ecclesiastes', 12, 'OT'],
  ['SNG', 'Song of Solomon', 8, 'OT'], ['ISA', 'Isaiah', 66, 'OT'], ['JER', 'Jeremiah', 52, 'OT'],
  ['LAM', 'Lamentations', 5, 'OT'], ['EZK', 'Ezekiel', 48, 'OT'], ['DAN', 'Daniel', 12, 'OT'],
  ['HOS', 'Hosea', 14, 'OT'], ['JOL', 'Joel', 3, 'OT'], ['AMO', 'Amos', 9, 'OT'],
  ['OBA', 'Obadiah', 1, 'OT'], ['JON', 'Jonah', 4, 'OT'], ['MIC', 'Micah', 7, 'OT'],
  ['NAM', 'Nahum', 3, 'OT'], ['HAB', 'Habakkuk', 3, 'OT'], ['ZEP', 'Zephaniah', 3, 'OT'],
  ['HAG', 'Haggai', 2, 'OT'], ['ZEC', 'Zechariah', 14, 'OT'], ['MAL', 'Malachi', 4, 'OT'],
  ['MAT', 'Matthew', 28, 'NT'], ['MRK', 'Mark', 16, 'NT'], ['LUK', 'Luke', 24, 'NT'],
  ['JHN', 'John', 21, 'NT'], ['ACT', 'Acts', 28, 'NT'], ['ROM', 'Romans', 16, 'NT'],
  ['1CO', '1 Corinthians', 16, 'NT'], ['2CO', '2 Corinthians', 13, 'NT'], ['GAL', 'Galatians', 6, 'NT'],
  ['EPH', 'Ephesians', 6, 'NT'], ['PHP', 'Philippians', 4, 'NT'], ['COL', 'Colossians', 4, 'NT'],
  ['1TH', '1 Thessalonians', 5, 'NT'], ['2TH', '2 Thessalonians', 3, 'NT'], ['1TI', '1 Timothy', 6, 'NT'],
  ['2TI', '2 Timothy', 4, 'NT'], ['TIT', 'Titus', 3, 'NT'], ['PHM', 'Philemon', 1, 'NT'],
  ['HEB', 'Hebrews', 13, 'NT'], ['JAS', 'James', 5, 'NT'], ['1PE', '1 Peter', 5, 'NT'],
  ['2PE', '2 Peter', 3, 'NT'], ['1JN', '1 John', 5, 'NT'], ['2JN', '2 John', 1, 'NT'],
  ['3JN', '3 John', 1, 'NT'], ['JUD', 'Jude', 1, 'NT'], ['REV', 'Revelation', 22, 'NT'],
]

const NAME_TO_ID = new Map(BOOKS.flatMap(([id, name]) => {
  const aliases = [name]
  if (name === 'Psalms') aliases.push('Psalm')
  if (name === 'Song of Solomon') aliases.push('Song of Songs', 'Canticles', 'The Song of Solomon')
  if (name === 'Revelation') aliases.push('The Revelation', 'Revelation of John', 'The Apocalypse')
  return aliases.map((alias) => [alias.toLowerCase(), id])
}))
for (const [alias, id] of [
  ['i samuel', '1SA'], ['ii samuel', '2SA'], ['i kings', '1KI'], ['ii kings', '2KI'],
  ['i chronicles', '1CH'], ['ii chronicles', '2CH'], ['i corinthians', '1CO'], ['ii corinthians', '2CO'],
  ['i thessalonians', '1TH'], ['ii thessalonians', '2TH'], ['i timothy', '1TI'], ['ii timothy', '2TI'],
  ['i peter', '1PE'], ['ii peter', '2PE'], ['i john', '1JN'], ['ii john', '2JN'], ['iii john', '3JN'],
]) NAME_TO_ID.set(alias, id)

const USFM_TO_ID = new Map(BOOKS.map(([id]) => [id, id]))
for (const [from, to] of [['EZE', 'EZK'], ['NAH', 'NAM'], ['SOS', 'SNG'], ['SOL', 'SNG'], ['JOH', 'JHN'], ['PSM', 'PSA']]) {
  USFM_TO_ID.set(from, to)
}

const TSK = {
  ge: 'GEN', ex: 'EXO', le: 'LEV', nu: 'NUM', de: 'DEU', jos: 'JOS', jud: 'JDG', ru: 'RUT',
  '1sa': '1SA', '2sa': '2SA', '1ki': '1KI', '2ki': '2KI', '1ch': '1CH', '2ch': '2CH',
  ezr: 'EZR', ne: 'NEH', es: 'EST', job: 'JOB', ps: 'PSA', pr: 'PRO', ec: 'ECC', so: 'SNG',
  isa: 'ISA', jer: 'JER', la: 'LAM', eze: 'EZK', da: 'DAN', ho: 'HOS', joe: 'JOL', am: 'AMO',
  ob: 'OBA', jon: 'JON', mic: 'MIC', na: 'NAM', hab: 'HAB', zep: 'ZEP', hag: 'HAG', zec: 'ZEC', mal: 'MAL',
  mt: 'MAT', mr: 'MRK', lu: 'LUK', joh: 'JHN', ac: 'ACT', ro: 'ROM', '1co': '1CO', '2co': '2CO',
  ga: 'GAL', eph: 'EPH', php: 'PHP', col: 'COL', '1th': '1TH', '2th': '2TH', '1ti': '1TI', '2ti': '2TI',
  tit: 'TIT', phm: 'PHM', heb: 'HEB', jas: 'JAS', '1pe': '1PE', '2pe': '2PE', '1jo': '1JN', '2jo': '2JN',
  '3jo': '3JN', jude: 'JUD', re: 'REV',
}

const STOP = new Set(`a an the and of to in that for with as on by be is it or at from his he her they was were this which but not thou thee thy ye you your shall unto hath have had their them him my me we our us who whom whose so if when then there these those into upon out up no nor than also even all any are wast art thou wilt doth did do done may might can could should would unto o oh ye yea yet`.split(/\s+/))

mkdirSync(cache, { recursive: true })

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 1000) {
    console.log('cached', dest)
    return
  }
  console.log('download', url)
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`${url} ${response.status}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
}

function readText(file) {
  const buf = readFileSync(file)
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le')
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.toString('utf8').replace(/^\uFEFF/, '')
  const sample = buf.subarray(0, 400)
  let zeros = 0
  for (const byte of sample) if (byte === 0) zeros += 1
  const text = zeros > 40 ? buf.toString('utf16le') : buf.toString('utf8')
  return text.replace(/^\uFEFF/, '')
}

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function normStrong(raw, letter) {
  const match = String(raw).toUpperCase().match(/([HG])?\s*0*(\d+)/)
  if (!match) return null
  return `${match[1] || letter}${Number(match[2])}`
}

function pushToken(tokens, text, strongs) {
  if (!text) return
  const tag = strongs.length ? [...new Set(strongs)].join('+') : ''
  const last = tokens[tokens.length - 1]
  if (!tag && last && last.length === 1) {
    last[0] += text
    return
  }
  tokens.push(tag ? [text, tag] : [text])
}

function tokensFromOsis(raw) {
  let text = decode(raw)
    .replace(/<note[\s\S]*?<\/note>/gi, '')
    .replace(/<lb\s*\/?>/gi, '\n')
    .replace(/<w\b[^>]*\/>/gi, '')
    .replace(/<(?!\/?w\b)[^>]+>/g, '')
  const tokens = []
  const re = /<w\b([^>]*)>([\s\S]*?)<\/w>|([^<]+)/g
  let match
  while ((match = re.exec(text))) {
    if (match[3] != null) {
      pushToken(tokens, match[3], [])
      continue
    }
    const strongs = []
    const lemma = match[1] || ''
    for (const found of lemma.matchAll(/strong:([HG]\d+)/gi)) {
      const id = normStrong(found[1])
      if (id) strongs.push(id)
    }
    pushToken(tokens, decode(match[2]).replace(/<[^>]+>/g, ''), strongs)
  }
  if (!tokens.length && text.trim()) pushToken(tokens, text, [])
  return tokens
}

function plainOf(tokens) {
  return tokens.map((token) => token[0]).join('').replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
}

function parseOsis(file) {
  console.log('parse KJV')
  const data = JSON.parse(readText(file))
  const books = {}
  const unknown = new Set()
  for (const book of data.books ?? data) {
    const id = NAME_TO_ID.get(String(book.name ?? '').trim().toLowerCase())
    if (!id) {
      unknown.add(book.name)
      continue
    }
    const chapters = {}
    for (const chapter of book.chapters ?? []) {
      const verses = {}
      for (const verse of chapter.verses ?? []) {
        const tokens = tokensFromOsis(String(verse.text ?? ''))
        if (plainOf(tokens)) verses[String(verse.verse)] = tokens
      }
      if (Object.keys(verses).length) chapters[String(chapter.chapter)] = verses
    }
    books[id] = { chapters }
  }
  if (unknown.size) console.log('skipped books', [...unknown].join(', '))
  return books
}

function cleanUsfm(text) {
  return text
    .replace(/\\f[\s+][\s\S]*?\\f\*/g, ' ')
    .replace(/\\fe[\s+][\s\S]*?\\fe\*/g, ' ')
    .replace(/\\x[\s+][\s\S]*?\\x\*/g, ' ')
    .replace(/\\fig[\s\S]*?\\fig\*/g, ' ')
    .replace(/\|[^\s\\]*/g, '')
    .replace(/\\[+]?\w+\*?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseUsfmFile(file) {
  const src = readText(file)
  const idLine = src.match(/\\id\s+([A-Z0-9]{2,4})/)
  const code = idLine?.[1]
  const bookId = code ? USFM_TO_ID.get(code) : undefined
  if (!bookId) return null
  const chapters = {}
  let chapter = 0
  let verse = 0
  let buf = ''
  let pending = ''
  const close = () => {
    if (!chapter || !verse) return
    const text = cleanUsfm(buf)
    if (text) {
      const slot = chapters[chapter] ?? (chapters[chapter] = {})
      slot[verse] = slot[verse] ? `${slot[verse]} ${text}` : text
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
  const shaped = {}
  for (const [key, verses] of Object.entries(chapters)) shaped[key] = verses
  return { id: bookId, chapters: shaped }
}

function parseWeb(dir) {
  console.log('parse WEB')
  const files = []
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(usfm|sfm)$/i.test(name)) files.push(path)
    }
  }
  walk(dir)
  const books = {}
  for (const file of files) {
    const parsed = parseUsfmFile(file)
    if (parsed) books[parsed.id] = { chapters: parsed.chapters }
  }
  console.log('WEB files', files.length, 'books', Object.keys(books).length)
  return books
}

function parseChunk(chunk) {
  const cleaned = chunk.trim().toLowerCase().replace(/\./g, '').replace(/^(see|cf|compare|and)\s+/, '')
  const match = cleaned.match(/^([1-3]?[a-z]+)\s+(\d+)\s*:\s*(\d+)([\s\S]*)$/)
  if (!match) return []
  const book = TSK[match[1]]
  if (!book) return []
  const chapter = Number(match[2])
  const verse = Number(match[3])
  if (!chapter || !verse) return []
  const rest = match[4] || ''
  const ids = []
  const push = (start, end) => {
    if (!start) return
    ids.push(end > start ? `${book}.${chapter}.${start}-${end}` : `${book}.${chapter}.${start}`)
  }
  let end = verse
  const range = rest.match(/^-(\d+)(?::(\d+))?/)
  if (range) {
    if (range[2]) {
      if (Number(range[1]) === chapter) end = Number(range[2])
    } else end = Number(range[1])
  }
  push(verse, end)
  for (const extra of rest.matchAll(/,(\d+)(?:-(\d+))?/g)) {
    const start = Number(extra[1])
    const stop = extra[2] ? Number(extra[2]) : start
    push(start, stop)
  }
  return ids
}

function parseTsk(file) {
  console.log('parse TSK')
  const text = readText(file)
  const byBook = {}
  let rows = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 6) continue
    const bookKey = Number(cols[0])
    if (!bookKey || bookKey > 66) continue
    const book = BOOKS[bookKey - 1]?.[0]
    const chapter = Number(cols[1])
    const verse = Number(cols[2])
    if (!book || !chapter || !verse) continue
    const phrase = cols[4].replace(/\s+/g, ' ').trim().slice(0, 120)
    const ids = []
    for (const chunk of cols.slice(5).join('\t').split(';')) ids.push(...parseChunk(chunk))
    if (!ids.length) continue
    const bookRefs = byBook[book] ?? (byBook[book] = {})
    const key = `${chapter}:${verse}`
    const groups = bookRefs[key] ?? (bookRefs[key] = [])
    let group = groups.find((item) => item.p === phrase)
    if (!group) {
      group = { p: phrase, v: [] }
      groups.push(group)
    }
    const self = `${book}.${chapter}.${verse}`
    for (const id of ids) {
      if (id === self) continue
      if (!group.v.includes(id)) group.v.push(id)
    }
    if (!group.v.length) groups.pop()
    rows += 1
  }
  console.log('TSK rows', rows)
  return byBook
}

function expandStrongGloss(raw) {
  const text = String(raw).replace(/\[(?:idiom|phrase)\]/gi, ' ').replace(/\bnatins\b/g, 'nations')
  const pieces = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '(') depth += 1
    else if (ch === ')' && depth) depth -= 1
    if (ch === ',' && depth === 0) {
      pieces.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) pieces.push(current)

  const senses = []
  const seen = new Set()
  const push = (sense) => {
    const clean = sense.replace(/[()]/g, ' ').replace(/^[+×.\s]+/, '').replace(/[.;:\s]+$/g, '').replace(/\s+/g, ' ').trim()
    if (!clean || /^x$/i.test(clean)) return
    if (seen.has(clean)) return
    seen.add(clean)
    senses.push(clean)
  }
  const fragment = new Set(['ly', 'ed', 'ing', 'es', 'est', 'ward', 'ness', 'er', 'eth'])
  const joinStem = (stem, suffix) => {
    if (!suffix) return stem
    if (stem.endsWith('e') && /^(ed|ing|er|est|es)$/.test(suffix)) return stem.slice(0, -1) + suffix
    return stem + suffix
  }

  for (let piece of pieces) {
    piece = piece.trim().replace(/^(?:X|×)\s+/i, '').replace(/\(([A-Za-z]+)\)\s+(?=[A-Za-z])/g, '$1 ')
    let prefix = ''
    const prefixMatch = piece.match(/^\(([A-Za-z]+)-\)/)
    if (prefixMatch) {
      prefix = prefixMatch[1]
      piece = piece.slice(prefixMatch[0].length).trim()
    }
    const core = piece.match(/^([A-Za-z][A-Za-z'’]*)/)?.[1] ?? ''
    const suffix = core ? piece.match(/\(([^)]*-[^)]*)\)/) : null
    const suffixAtCore = Boolean(suffix && piece.slice(core.length).trim().startsWith('('))
    if (core && (prefix || suffixAtCore)) {
      const stems = prefix && fragment.has(core) ? [prefix + core] : prefix ? [core, prefix + core] : [core]
      const head = stems[stems.length - 1]
      if (!suffixAtCore || !suffix) {
        for (const stem of stems) push(stem)
      } else {
        const parts = suffix[1].split(',').map((part) => part.trim()).filter(Boolean)
        const pure = parts.every((part) => part.startsWith('-'))
        if (pure) {
          for (const stem of stems) {
            push(stem)
            for (const part of parts) push(joinStem(stem, part.slice(1)))
          }
        } else {
          for (const stem of stems) push(stem)
          for (const part of parts) {
            if (part.startsWith('-')) push(joinStem(head, part.slice(1)))
            else if (suffix[1].trim().startsWith('-')) push(`${head} ${part}`)
            else push(part)
          }
        }
        piece = piece.replace(suffix[0], ' ')
      }
      piece = piece.replace(core, ' ')
    }
    if (!piece.includes('(')) {
      push(piece)
      continue
    }
    const outside = piece.replace(/\([^)]*\)/g, ' ')
    push(outside)
    for (const inner of piece.matchAll(/\(([^)]*)\)/g)) {
      const trimmed = inner[1].trim()
      if (!trimmed || trimmed.includes('-')) continue
      const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean)
      const short = parts.every((part) => part.split(/\s+/).length <= 3 && part.length <= 24) && trimmed.length <= 48
      if (short) for (const part of parts) push(part)
    }
  }
  return senses.join(', ')
}

function clipText(text) {
  const clean = String(text).replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length < 2) return ''
  if (clean.length <= 280) return clean
  const cut = clean.lastIndexOf(' ', 280)
  return `${(cut > 40 ? clean.slice(0, cut) : clean.slice(0, 280)).trim()}…`
}

function loadDict(file, letter) {
  const src = readText(file)
  const start = src.indexOf('{')
  const end = src.lastIndexOf('}')
  const body = src.slice(start, end + 1)
  let data
  try {
    data = JSON.parse(body)
  } catch {
    data = Function(`"use strict"; return (${body})`)()
  }
  const gloss = {}
  for (const [key, entry] of Object.entries(data)) {
    const id = normStrong(key, letter)
    if (!id || !entry || typeof entry !== 'object') continue
    let raw = expandStrongGloss(entry.kjv_def || '')
    if (raw.length < 2) raw = expandStrongGloss(entry.strongs_def || '')
    raw = raw.replace(/[,\s]+$/, '')
    let glossText = raw
    if (glossText.length > 96) {
      const cut = glossText.lastIndexOf(',', 96)
      glossText = (cut > 24 ? glossText.slice(0, cut) : glossText.slice(0, 96)).replace(/[,\s]+$/, '')
    }
    const item = { g: glossText }
    if (entry.lemma) item.l = String(entry.lemma)
    const translit = entry.xlit || entry.translit
    if (translit) item.x = String(translit)
    const pronounce = String(entry.pron || '').replace(/\s+/g, ' ').trim()
    if (pronounce) item.p = pronounce.slice(0, 48)
    const defined = clipText(entry.strongs_def || '')
    if (defined) item.d = defined
    const derived = clipText(entry.derivation || '')
    if (derived) item.r = derived
    gloss[id] = item
  }
  return gloss
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value))
}

function indexText(books) {
  const concord = new Map()
  const strongVerses = new Map()
  const surfaces = new Map()
  const addWord = (word, id) => {
    const key = word.toLowerCase().replace(/^'+|'+$/g, '')
    if (key.length < 2 || !/[a-z]/.test(key)) return
    let entry = concord.get(key)
    if (!entry) {
      entry = { n: 0, v: [], seen: new Set() }
      concord.set(key, entry)
    }
    entry.n += 1
    if (entry.seen.has(id)) return
    entry.seen.add(id)
    const cap = STOP.has(key) ? 30 : Infinity
    if (entry.v.length < cap) entry.v.push(id)
  }
  for (const [book, file] of Object.entries(books)) {
    for (const [chapter, verses] of Object.entries(file.chapters)) {
      for (const [verse, tokens] of Object.entries(verses)) {
        const id = `${book}.${chapter}.${verse}`
        const text = plainOf(tokens)
        for (const word of text.matchAll(/[A-Za-z][A-Za-z']*/g)) addWord(word[0], id)
        for (const token of tokens) {
          if (!token[1]) continue
          const surface = token[0].trim()
          for (const strong of token[1].split('+')) {
            if (!strongVerses.has(strong)) strongVerses.set(strong, [])
            const list = strongVerses.get(strong)
            if (list[list.length - 1] !== id) list.push(id)
            if (surface && /[A-Za-z]/.test(surface)) {
              if (!surfaces.has(strong)) surfaces.set(strong, new Map())
              const counts = surfaces.get(strong)
              counts.set(surface.toLowerCase(), (counts.get(surface.toLowerCase()) ?? 0) + 1)
            }
          }
        }
      }
    }
  }
  return { concord, strongVerses, surfaces }
}

function png(size, draw) {
  const rowSize = 1 + size * 3
  const raw = Buffer.alloc(rowSize * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * rowSize
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = draw(x, y, size)
      const i = row + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const crcTable = []
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  const crc32 = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const outBuf = Buffer.alloc(12 + data.length)
    outBuf.writeUInt32BE(data.length, 0)
    body.copy(outBuf, 4)
    outBuf.writeUInt32BE(crc32(body), 8 + data.length)
    return outBuf
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function iconColor(x, y, size) {
  const ink = [28, 25, 21]
  const gold = [196, 164, 106]
  const paper = [243, 232, 208]
  const nx = x / size
  const ny = y / size
  const inPage = nx > 0.18 && nx < 0.82 && ny > 0.16 && ny < 0.84
  const gutter = Math.abs(nx - 0.5) < 0.012 && ny > 0.22 && ny < 0.78
  const line = inPage && ny > 0.32 && ny < 0.72 && Math.abs((ny * 40) % 1 - 0.5) < 0.08 && Math.abs(nx - 0.5) > 0.05
  if (gutter || line) return gold
  if (inPage) return paper
  return ink
}

async function main() {
  await download('https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/en/KJV/KJV-osis.json', join(cache, 'KJV-osis.json'))
  await download('https://raw.githubusercontent.com/ariseshinestudio/TSK/main/tskxref.txt', join(cache, 'tskxref.txt'))
  await download('https://ebible.org/Scriptures/engwebp_usfm.zip', join(cache, 'engwebp_usfm.zip'))
  await download('https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js', join(cache, 'strongs-hebrew-dictionary.js'))
  await download('https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js', join(cache, 'strongs-greek-dictionary.js'))

  const webDir = join(cache, 'web')
  if (!existsSync(webDir) || readdirSync(webDir).length === 0) {
    mkdirSync(webDir, { recursive: true })
    execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${join(cache, 'engwebp_usfm.zip')}' -DestinationPath '${webDir}' -Force`], { stdio: 'inherit' })
  }

  const kjv = parseOsis(join(cache, 'KJV-osis.json'))
  const web = parseWeb(webDir)
  const missingKjv = BOOKS.map(([id]) => id).filter((id) => !kjv[id])
  const missingWeb = BOOKS.map(([id]) => id).filter((id) => !web[id])
  if (missingKjv.length || missingWeb.length) {
    throw new Error(`Missing books KJV:${missingKjv.join(',')} WEB:${missingWeb.join(',')}`)
  }

  for (const [id] of BOOKS) {
    writeJson(join(out, 'text', 'kjv', `${id}.json`), kjv[id])
    writeJson(join(out, 'text', 'web', `${id}.json`), web[id])
  }

  const xrefs = parseTsk(join(cache, 'tskxref.txt'))
  for (const [id] of BOOKS) writeJson(join(out, 'xrefs', `${id}.json`), xrefs[id] ?? {})

  const { concord, strongVerses, surfaces } = indexText(kjv)
  const shards = new Map()
  for (const [word, entry] of concord) {
    const letter = /[a-z]/.test(word[0]) ? word[0] : 'a'
    if (!shards.has(letter)) shards.set(letter, {})
    shards.get(letter)[word] = { n: entry.seen.size, v: entry.v }
  }
  for (const [letter, data] of shards) writeJson(join(out, 'concord', `${letter}.json`), data)

  const hebrew = loadDict(join(cache, 'strongs-hebrew-dictionary.js'), 'H')
  const greek = loadDict(join(cache, 'strongs-greek-dictionary.js'), 'G')
  const gloss = {}
  const strongShards = new Map()
  for (const [id, verses] of strongVerses) {
    const dict = (id.startsWith('G') ? greek[id] : hebrew[id]) ?? {}
    let g = dict.g
    if (!g) {
      const counts = surfaces.get(id)
      g = counts ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] : id
    }
    gloss[id] = {
      g,
      ...(dict.l ? { l: dict.l } : {}),
      ...(dict.x ? { x: dict.x } : {}),
      ...(dict.p ? { p: dict.p } : {}),
      ...(dict.d ? { d: dict.d } : {}),
      ...(dict.r ? { r: dict.r } : {}),
    }
    const bucket = `${id[0]}${Number(id.slice(1)) < 1000 ? 0 : Math.floor(Number(id.slice(1)) / 1000)}`
    if (!strongShards.has(bucket)) strongShards.set(bucket, {})
    strongShards.get(bucket)[id] = verses
  }
  writeJson(join(out, 'gloss.json'), gloss)
  for (const [bucket, data] of strongShards) writeJson(join(out, 'strongs', `${bucket}.json`), data)

  const gen = plainOf(kjv.GEN.chapters['1']['1'])
  const john = plainOf(kjv.JHN.chapters['3']['16'])
  const webJohn = web.JHN.chapters['3']['16']
  if (!gen.includes('In the beginning')) throw new Error(`Unexpected Genesis 1:1: ${gen}`)
  if (!john.toLowerCase().includes('god so loved') || john.includes('<')) throw new Error(`Unexpected John 3:16: ${john}`)
  if (!String(webJohn).toLowerCase().includes('god so loved') || String(webJohn).includes('\\w')) throw new Error(`Unexpected WEB John 3:16: ${webJohn}`)
  if (!xrefs.GEN?.['1:1']?.length) throw new Error('Genesis 1:1 has no cross-references')
  const strongs = kjv.GEN.chapters['1']['1'].flatMap((token) => (token[1] ? token[1].split('+') : []))
  if (!strongs.length) throw new Error('Genesis 1:1 has no Strong’s numbers')
  const expectGloss = (id, pattern) => {
    if (!pattern.test(String(gloss[id]?.g || ''))) throw new Error(`${id} gloss: ${gloss[id]?.g}`)
  }
  expectGloss('G1519', /^abundantly,/)
  expectGloss('H7225', /chiefest/)
  expectGloss('H7225', /firstfruits/)
  expectGloss('H430', /God/)
  expectGloss('H430', /goddess/i)
  expectGloss('H853', /self/)
  expectGloss('G2316', /^exceeding, God, god, godly, godward$/)
  expectGloss('G25', /^love, loved, belove, beloved$/)
  if (String(gloss.H1961?.g || '').includes(')')) throw new Error(`H1961 gloss: ${gloss.H1961?.g}`)

  writeJson(join(out, 'meta.json'), {
    translations: [
      { id: 'kjv', name: 'King James Version' },
      { id: 'web', name: 'World English Bible' },
    ],
    books: BOOKS.map(([id, name, chapters, testament]) => ({ id, name, chapters, testament })),
  })

  const publicDir = join(root, 'public')
  for (const size of [180, 192, 512]) {
    writeFileSync(join(publicDir, `icon-${size}.png`), png(size, iconColor))
  }

  console.log('ready', {
    gen,
    john,
    webJohn,
    genRefs: xrefs.GEN['1:1'].length,
    strongs: strongs.join(','),
    gloss: gloss[strongs[0]],
    words: concord.size,
  })
  execFileSync(process.execPath, [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'scripts', 'mark-divine.ts')], { stdio: 'inherit', cwd: root })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
