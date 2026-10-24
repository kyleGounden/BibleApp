export type Glyph = { key: string; text: string; name: string; sound: string }

export type Script = 'he' | 'gr'

const HEBREW: Record<string, { name: string; sound: string; base: string }> = {
  א: { name: 'Aleph', sound: 'silent, a gentle stop', base: 'א' },
  ב: { name: 'Bet', sound: 'b, or v with no dot', base: 'ב' },
  ג: { name: 'Gimel', sound: 'g', base: 'ג' },
  ד: { name: 'Dalet', sound: 'd', base: 'ד' },
  ה: { name: 'He', sound: 'h', base: 'ה' },
  ו: { name: 'Vav', sound: 'v, or a vowel when it carries one', base: 'ו' },
  ז: { name: 'Zayin', sound: 'z', base: 'ז' },
  ח: { name: 'Chet', sound: 'ch, as in Bach', base: 'ח' },
  ט: { name: 'Tet', sound: 't', base: 'ט' },
  י: { name: 'Yod', sound: 'y', base: 'י' },
  כ: { name: 'Kaf', sound: 'k, or kh with no dot', base: 'כ' },
  ך: { name: 'Kaf', sound: 'kh, the form at the end of a word', base: 'כ' },
  ל: { name: 'Lamed', sound: 'l', base: 'ל' },
  מ: { name: 'Mem', sound: 'm', base: 'מ' },
  ם: { name: 'Mem', sound: 'm, the form at the end of a word', base: 'מ' },
  נ: { name: 'Nun', sound: 'n', base: 'נ' },
  ן: { name: 'Nun', sound: 'n, the form at the end of a word', base: 'נ' },
  ס: { name: 'Samekh', sound: 's', base: 'ס' },
  ע: { name: 'Ayin', sound: 'silent, a deeper stop', base: 'ע' },
  פ: { name: 'Pe', sound: 'p, or f with no dot', base: 'פ' },
  ף: { name: 'Pe', sound: 'f, the form at the end of a word', base: 'פ' },
  צ: { name: 'Tsadi', sound: 'ts', base: 'צ' },
  ץ: { name: 'Tsadi', sound: 'ts, the form at the end of a word', base: 'צ' },
  ק: { name: 'Qof', sound: 'k, deep in the throat', base: 'ק' },
  ר: { name: 'Resh', sound: 'r', base: 'ר' },
  ש: { name: 'Shin', sound: 'sh, or s when the dot is on the left', base: 'ש' },
  ת: { name: 'Tav', sound: 't', base: 'ת' },
}

const VOWEL_NAME: Record<string, { name: string; sound: string }> = {
  '\u05B0': { name: 'sheva', sound: 'e' },
  '\u05B1': { name: 'hataf segol', sound: 'e' },
  '\u05B2': { name: 'hataf patah', sound: 'a' },
  '\u05B3': { name: 'hataf qamats', sound: 'o' },
  '\u05B4': { name: 'hiriq', sound: 'i' },
  '\u05B5': { name: 'tsere', sound: 'e' },
  '\u05B6': { name: 'segol', sound: 'e' },
  '\u05B7': { name: 'patah', sound: 'a' },
  '\u05B8': { name: 'qamats', sound: 'a' },
  '\u05B9': { name: 'holam', sound: 'o' },
  '\u05BA': { name: 'holam', sound: 'o' },
  '\u05BB': { name: 'qubuts', sound: 'u' },
  '\u05C7': { name: 'qamats', sound: 'o' },
}

const GREEK: Record<string, { name: string; sound: string; base: string }> = {
  α: { name: 'Alpha', sound: 'a', base: 'α' },
  β: { name: 'Beta', sound: 'b', base: 'β' },
  γ: { name: 'Gamma', sound: 'g', base: 'γ' },
  δ: { name: 'Delta', sound: 'd', base: 'δ' },
  ε: { name: 'Epsilon', sound: 'e', base: 'ε' },
  ζ: { name: 'Zeta', sound: 'z', base: 'ζ' },
  η: { name: 'Eta', sound: 'ay, a long e', base: 'η' },
  θ: { name: 'Theta', sound: 'th', base: 'θ' },
  ι: { name: 'Iota', sound: 'i', base: 'ι' },
  κ: { name: 'Kappa', sound: 'k', base: 'κ' },
  λ: { name: 'Lambda', sound: 'l', base: 'λ' },
  μ: { name: 'Mu', sound: 'm', base: 'μ' },
  ν: { name: 'Nu', sound: 'n', base: 'ν' },
  ξ: { name: 'Xi', sound: 'x', base: 'ξ' },
  ο: { name: 'Omicron', sound: 'o', base: 'ο' },
  π: { name: 'Pi', sound: 'p', base: 'π' },
  ρ: { name: 'Rho', sound: 'r', base: 'ρ' },
  σ: { name: 'Sigma', sound: 's', base: 'σ' },
  ς: { name: 'Sigma', sound: 's, the form at the end of a word', base: 'σ' },
  τ: { name: 'Tau', sound: 't', base: 'τ' },
  υ: { name: 'Upsilon', sound: 'u', base: 'υ' },
  φ: { name: 'Phi', sound: 'f', base: 'φ' },
  χ: { name: 'Chi', sound: 'ch, as in Bach', base: 'χ' },
  ψ: { name: 'Psi', sound: 'ps', base: 'ψ' },
  ω: { name: 'Omega', sound: 'o, long', base: 'ω' },
}

const HEBREW_COUNT = 22
const GREEK_COUNT = 24

export function alphabetSize(script: Script): number {
  return script === 'he' ? HEBREW_COUNT : GREEK_COUNT
}

export function letterKey(script: Script, base: string): string {
  return `${script}:${base}`
}

export function glyphs(word: string, script: Script): Glyph[] {
  if (script === 'gr') return greekGlyphs(word)
  return hebrewGlyphs(word)
}

function hebrewGlyphs(word: string): Glyph[] {
  const chars = [...word]
  const out: Glyph[] = []
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i]
    const info = HEBREW[char]
    if (!info) continue
    const marks: string[] = []
    let j = i + 1
    while (j < chars.length && /[\u0591-\u05C7]/.test(chars[j])) {
      marks.push(chars[j])
      j += 1
    }
    i = j - 1
    const dagesh = marks.includes('\u05BC')
    const sin = marks.includes('\u05C2')
    const vowel = marks.map((mark) => VOWEL_NAME[mark]).find(Boolean)
    let sound = info.sound
    if (char === 'ב' || char === 'פ' || char === 'כ') sound = dagesh ? info.sound.split(',')[0] : info.sound
    if (char === 'ש') sound = sin ? 's' : 'sh'
    if (char === 'ו' && dagesh && !vowel) sound = 'u'
    if (char === 'ו' && vowel?.sound === 'o') sound = 'o'
    const name = vowel ? `${info.name} with ${vowel.name}` : info.name
    const spoken = vowel ? `${sound}. The vowel is ${vowel.sound}` : sound
    out.push({
      key: letterKey('he', info.base),
      text: char + marks.join(''),
      name,
      sound: spoken,
    })
  }
  return out
}

function greekGlyphs(word: string): Glyph[] {
  const out: Glyph[] = []
  for (const char of word.normalize('NFD')) {
    if (/\p{M}/u.test(char)) continue
    const lower = char.toLowerCase()
    const info = GREEK[lower]
    if (!info) continue
    out.push({
      key: letterKey('gr', info.base),
      text: char,
      name: info.name,
      sound: info.sound,
    })
  }
  return out
}

const SOFT: Record<string, [string, string]> = {
  ב: ['b', 'v'],
  כ: ['k', 'kh'],
  ך: ['k', 'kh'],
  פ: ['p', 'f'],
  ף: ['p', 'f'],
}

export function transliterate(word: string, script: Script): string {
  if (script === 'gr') return transliterateGreek(word)
  return transliterateHebrew(word)
}

function transliterateHebrew(word: string): string {
  const chars = [...word]
  let out = ''
  let first = true
  let lastWasVowel = false
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i]
    if (!HEBREW[char]) continue
    const marks: string[] = []
    let j = i + 1
    while (j < chars.length && /[\u0591-\u05C7]/.test(chars[j])) {
      marks.push(chars[j])
      j += 1
    }
    const nextCons = chars.slice(j).find((item) => HEBREW[item])
    i = j - 1
    const dagesh = marks.includes('\u05BC')
    const sin = marks.includes('\u05C2')
    const vowelMark = marks.find((mark) => VOWEL_NAME[mark])
    const vowel = vowelMark ? VOWEL_NAME[vowelMark] : undefined
    if (char === 'ו' && vowel?.sound === 'o') {
      out += 'o'
      lastWasVowel = true
      first = false
      continue
    }
    if (char === 'ו' && dagesh && !vowel) {
      out += 'u'
      lastWasVowel = true
      first = false
      continue
    }
    let base = ''
    if (char === 'ש') base = sin ? 's' : 'sh'
    else if (SOFT[char]) base = dagesh ? SOFT[char][0] : SOFT[char][1]
    else if (char === 'א' || char === 'ע') base = ''
    else base = { ג: 'g', ד: 'd', ה: 'h', ו: 'v', ז: 'z', ח: 'kh', ט: 't', י: 'y', ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', צ: 'ts', ץ: 'ts', ק: 'q', ר: 'r', ת: 't' }[char] ?? ''
    let voiced = vowel?.sound ?? ''
    if (vowelMark === '\u05B0') {
      const vocal = first || dagesh || !lastWasVowel
      voiced = vocal && (nextCons || first) ? 'e' : ''
    }
    if (char === 'ה' && !nextCons && !vowel) base = 'h'
    if (char === 'י' && lastWasVowel && !vowel && (out.endsWith('i') || out.endsWith('e'))) base = ''
    out += base + voiced
    lastWasVowel = Boolean(voiced)
    first = false
  }
  return out
}

const GREEK_SOUND: Record<string, string> = {
  α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'e', θ: 'th', ι: 'i', κ: 'k', λ: 'l',
  μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'u', φ: 'f',
  χ: 'ch', ψ: 'ps', ω: 'o',
}

function transliterateGreek(word: string): string {
  const bases: { ch: string; rough: boolean }[] = []
  for (const char of word.normalize('NFD')) {
    if (char === '\u0314' && bases.length) {
      bases[bases.length - 1].rough = true
      continue
    }
    if (/\p{M}/u.test(char)) continue
    const lower = char.toLowerCase()
    if (!GREEK_SOUND[lower]) continue
    bases.push({ ch: lower, rough: false })
  }
  let out = ''
  const head = bases[0]
  if (head && head.ch !== 'ρ' && (head.rough || (bases[1]?.rough && 'αεηιουω'.includes(head.ch)))) out = 'h'
  for (let i = 0; i < bases.length; i += 1) {
    const item = bases[i]
    const next = bases[i + 1]?.ch
    if (item.ch === 'α' && next === 'ι') { out += 'ai'; i += 1; continue }
    if (item.ch === 'ε' && next === 'ι') { out += 'ei'; i += 1; continue }
    if (item.ch === 'ο' && next === 'ι') { out += 'oi'; i += 1; continue }
    if (item.ch === 'υ' && next === 'ι') { out += 'ui'; i += 1; continue }
    if (item.ch === 'α' && next === 'υ') { out += 'au'; i += 1; continue }
    if ((item.ch === 'ε' || item.ch === 'η') && next === 'υ') { out += 'eu'; i += 1; continue }
    if (item.ch === 'ο' && next === 'υ') { out += 'ou'; i += 1; continue }
    if (item.ch === 'γ' && next === 'γ') { out += 'ng'; i += 1; continue }
    if (item.ch === 'γ' && (next === 'κ' || next === 'ξ')) { out += 'n'; continue }
    if (item.ch === 'γ' && next === 'χ') { out += 'n'; continue }
    if (item.ch === 'ρ' && item.rough) { out += 'rh'; continue }
    out += GREEK_SOUND[item.ch]
  }
  return out
}

export function consonants(word: string): string {
  return [...word].filter((char) => HEBREW[char] || GREEK[char.toLowerCase()]).join('')
}
