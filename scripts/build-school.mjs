import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cache = join(root, 'data-cache')
const out = join(root, 'public', 'data')

const HEBREW = [
  ['Gen', 'GEN'], ['Exod', 'EXO'], ['Lev', 'LEV'], ['Num', 'NUM'], ['Deut', 'DEU'],
  ['Josh', 'JOS'], ['Judg', 'JDG'], ['Ruth', 'RUT'], ['1Sam', '1SA'], ['2Sam', '2SA'],
  ['1Kgs', '1KI'], ['2Kgs', '2KI'], ['1Chr', '1CH'], ['2Chr', '2CH'], ['Ezra', 'EZR'],
  ['Neh', 'NEH'], ['Esth', 'EST'], ['Job', 'JOB'], ['Ps', 'PSA'], ['Prov', 'PRO'],
  ['Eccl', 'ECC'], ['Song', 'SNG'], ['Isa', 'ISA'], ['Jer', 'JER'], ['Lam', 'LAM'],
  ['Ezek', 'EZK'], ['Dan', 'DAN'], ['Hos', 'HOS'], ['Joel', 'JOL'], ['Amos', 'AMO'],
  ['Obad', 'OBA'], ['Jonah', 'JON'], ['Mic', 'MIC'], ['Nah', 'NAM'], ['Hab', 'HAB'],
  ['Zeph', 'ZEP'], ['Hag', 'HAG'], ['Zech', 'ZEC'], ['Mal', 'MAL'],
]

const GREEK = [
  ['61-Mt-morphgnt.txt', 'MAT'], ['62-Mk-morphgnt.txt', 'MRK'], ['63-Lk-morphgnt.txt', 'LUK'],
  ['64-Jn-morphgnt.txt', 'JHN'], ['65-Ac-morphgnt.txt', 'ACT'], ['66-Ro-morphgnt.txt', 'ROM'],
  ['67-1Co-morphgnt.txt', '1CO'], ['68-2Co-morphgnt.txt', '2CO'], ['69-Ga-morphgnt.txt', 'GAL'],
  ['70-Eph-morphgnt.txt', 'EPH'], ['71-Php-morphgnt.txt', 'PHP'], ['72-Col-morphgnt.txt', 'COL'],
  ['73-1Th-morphgnt.txt', '1TH'], ['74-2Th-morphgnt.txt', '2TH'], ['75-1Ti-morphgnt.txt', '1TI'],
  ['76-2Ti-morphgnt.txt', '2TI'], ['77-Tit-morphgnt.txt', 'TIT'], ['78-Phm-morphgnt.txt', 'PHM'],
  ['79-Heb-morphgnt.txt', 'HEB'], ['80-Jas-morphgnt.txt', 'JAS'], ['81-1Pe-morphgnt.txt', '1PE'],
  ['82-2Pe-morphgnt.txt', '2PE'], ['83-1Jn-morphgnt.txt', '1JN'], ['84-2Jn-morphgnt.txt', '2JN'],
  ['85-3Jn-morphgnt.txt', '3JN'], ['86-Jud-morphgnt.txt', 'JUD'], ['87-Re-morphgnt.txt', 'REV'],
]

function clip(text, max = 280) {
  const clean = String(text).replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length < 2) return ''
  if (clean.length <= max) return clean
  const cut = clean.lastIndexOf(' ', max)
  return `${(cut > 40 ? clean.slice(0, cut) : clean.slice(0, max)).trim()}…`
}

function readDict(file) {
  const src = readFileSync(file, 'utf8')
  const start = src.indexOf('{')
  const end = src.lastIndexOf('}')
  const body = src.slice(start, end + 1)
  try {
    return JSON.parse(body)
  } catch {
    return Function(`"use strict"; return (${body})`)()
  }
}

function patchGloss() {
  const glossPath = join(out, 'gloss.json')
  const gloss = JSON.parse(readFileSync(glossPath, 'utf8'))
  const hebrew = readDict(join(cache, 'strongs-hebrew-dictionary.js'))
  const greek = readDict(join(cache, 'strongs-greek-dictionary.js'))
  let filled = 0
  for (const [id, item] of Object.entries(gloss)) {
    const num = id.replace(/^[HG]/, '')
    const entry = (id.startsWith('G') ? greek[`G${num}`] : hebrew[`H${num}`]) ?? (id.startsWith('G') ? greek[id] : hebrew[id])
    if (!entry) continue
    const pronounce = String(entry.pron || '').replace(/\s+/g, ' ').trim()
    const defined = clip(entry.strongs_def || '')
    const derived = clip(entry.derivation || '')
    if (pronounce) item.p = pronounce.slice(0, 48)
    if (defined) item.d = defined
    if (derived) item.r = derived
    if (pronounce || defined || derived) filled += 1
  }
  writeFileSync(glossPath, JSON.stringify(gloss))
  console.log('gloss fields', filled)
  return gloss
}

function foldGreek(text) {
  let out = ''
  for (const char of text.normalize('NFD').toLowerCase()) {
    if (char === 'ς') {
      out += 'σ'
      continue
    }
    if (char === '\u0313' || char === '\u0314') {
      out += char
      continue
    }
    if (/\p{M}/u.test(char)) continue
    out += char
  }
  return out
}

function lemmaKeys(lemma) {
  const raw = String(lemma).replace(/[⸀⸁⸂⸃⟦⟧]/g, '')
  const full = raw.replace(/[()]/g, '')
  const plain = raw.replace(/\([^)]*\)/g, '')
  return [...new Set([foldGreek(full), foldGreek(plain)].filter(Boolean))]
}

function lemmaMap(gloss) {
  const map = new Map()
  const clash = new Set()
  for (const [id, item] of Object.entries(gloss)) {
    if (!id.startsWith('G') || !item.l) continue
    for (const key of lemmaKeys(item.l)) {
      const have = map.get(key)
      if (have && have !== id) clash.add(key)
      else map.set(key, id)
    }
  }
  for (const key of clash) map.delete(key)
  console.log('greek lemmas', map.size, 'ambiguous', clash.size)
  return map
}

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 500) return
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  const buf = Buffer.from(await response.arrayBuffer())
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, buf)
  console.log('got', dest)
}

async function pool(jobs, size) {
  let index = 0
  async function worker() {
    while (index < jobs.length) {
      const job = jobs[index]
      index += 1
      await job()
    }
  }
  await Promise.all(Array.from({ length: size }, worker))
}

function stripCant(text) {
  return text.replace(/[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3-\u05C6\u200C\u200D]/g, '')
}

function strongOf(piece) {
  const match = String(piece).match(/(\d+)/)
  if (!match) return ''
  const n = Number(match[1])
  return n ? `H${n}` : ''
}

function segments(surface, lemma, morph) {
  const faces = surface.split('/')
  const lemmas = lemma.split('/')
  const codes = morph.split('/')
  const lang = morph.startsWith('A') ? 'A' : 'H'
  if (faces.length > 1 && faces.length === lemmas.length && faces.length === codes.length) {
    return faces.map((face, i) => {
      let code = codes[i]
      if (!/^[HA]/.test(code)) code = lang + code
      const strong = strongOf(lemmas[i])
      const word = stripCant(face).replace(/\s+/g, '')
      return word ? { w: word, m: code, ...(strong ? { s: strong } : {}) } : null
    }).filter(Boolean)
  }
  const word = stripCant(surface).replace(/\//g, '').replace(/\s+/g, '')
  if (!word) return []
  let code = morph
  if (code && !/^[HA]/.test(code)) code = lang + code
  const strong = strongOf(lemma)
  return [{ w: word, m: code, ...(strong ? { s: strong } : {}) }]
}

function parseHebrew(file) {
  const src = readFileSync(file, 'utf8')
  const chapters = {}
  const verseRe = /<verse\b[^>]*osisID="[^"]+\.(\d+)\.(\d+)"[^>]*>([\s\S]*?)<\/verse>/g
  let verse
  while ((verse = verseRe.exec(src))) {
    const chapter = verse[1]
    const number = verse[2]
    const words = []
    const wordRe = /<w\b([^>]*)>([\s\S]*?)<\/w>/g
    let word
    while ((word = wordRe.exec(verse[3]))) {
      const attrs = word[1]
      const lemma = /lemma="([^"]*)"/.exec(attrs)?.[1] ?? ''
      const morph = /morph="([^"]*)"/.exec(attrs)?.[1] ?? ''
      const text = word[2].replace(/<[^>]+>/g, '')
      words.push(...segments(text, lemma, morph))
    }
    if (!words.length) continue
    if (!chapters[chapter]) chapters[chapter] = {}
    chapters[chapter][number] = words
  }
  return { chapters }
}

function parseGreek(file, lemmas) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  const chapters = {}
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = line.trim().split(/\s+/)
    if (cols.length < 7 || !/^\d{6}$/.test(cols[0])) continue
    const chapter = String(Number(cols[0].slice(2, 4)))
    const number = String(Number(cols[0].slice(4, 6)))
    const morph = `${cols[1]}${cols[2]}`
    const word = cols[4]
    const strong = lemmaKeys(cols[6]).map((key) => lemmas.get(key)).find(Boolean)
    if (!chapters[chapter]) chapters[chapter] = {}
    if (!chapters[chapter][number]) chapters[chapter][number] = []
    chapters[chapter][number].push({ w: word, m: morph, ...(strong ? { s: strong } : {}) })
  }
  return { chapters }
}

async function main() {
  const gloss = patchGloss()
  const lemmas = lemmaMap(gloss)
  const hebDir = join(cache, 'morphhb')
  const grDir = join(cache, 'morphgnt')
  mkdirSync(hebDir, { recursive: true })
  mkdirSync(grDir, { recursive: true })
  const jobs = [
    ...HEBREW.map(([name]) => () => download(
      `https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/${name}.xml`,
      join(hebDir, `${name}.xml`),
    )),
    ...GREEK.map(([name]) => () => download(
      `https://raw.githubusercontent.com/morphgnt/sblgnt/master/${name}`,
      join(grDir, name),
    )),
  ]
  await pool(jobs, 6)
  mkdirSync(join(out, 'original'), { recursive: true })
  for (const [name, id] of HEBREW) {
    const book = parseHebrew(join(hebDir, `${name}.xml`))
    writeFileSync(join(out, 'original', `${id}.json`), JSON.stringify(book))
    console.log(id, Object.keys(book.chapters).length, 'chapters')
  }
  for (const [name, id] of GREEK) {
    const book = parseGreek(join(grDir, name), lemmas)
    writeFileSync(join(out, 'original', `${id}.json`), JSON.stringify(book))
    console.log(id, Object.keys(book.chapters).length, 'chapters')
  }
  const gen = JSON.parse(readFileSync(join(out, 'original', 'GEN.json'), 'utf8'))
  const john = JSON.parse(readFileSync(join(out, 'original', 'JHN.json'), 'utf8'))
  console.log('GEN 1:1', gen.chapters['1']['1'].map((word) => `${word.w} ${word.m} ${word.s ?? ''}`).join(' | '))
  console.log('JHN 3:16', john.chapters['3']['16'].map((word) => `${word.w} ${word.m} ${word.s ?? ''}`).join(' | '))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
