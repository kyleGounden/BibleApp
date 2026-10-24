export type Range = [number, number]

const NAME =
  "(?:the\\s+angel\\s+of\\s+(?:the\\s+)?(?:LORD|Lord|God)|the\\s+LORD\\s+God|the\\s+Lord\\s+God|(?<![A-Za-z])God|the\\s+LORD|the\\s+Lord|the\\s+Father|the\\s+Holy\\s+(?:Spirit|Ghost)|the\\s+Spirit\\s+of\\s+(?:God|the\\s+LORD|the\\s+Lord)|a\\s+voice\\s+(?:from|out\\s+of)\\s+(?:the\\s+)?(?:heaven|heavens|whirlwind|cloud|excellent\\s+glory|throne|temple))"

const FORWARD = new RegExp(
  `(?:Thus\\s+(?:saith|says)\\s+the\\s+(?:LORD|Lord)(?:\\s+God)?(?:\\s+of\\s+hosts)?|the\\s+word\\s+of\\s+the\\s+(?:LORD|Lord)\\s+came\\b[^.]{0,180}?\\bsaying|${NAME}\\b[^.]{0,120}?\\b(?:said|saith|spake|spoke|saying)|${NAME}\\s+hath\\s+spoken)`,
  'gi',
)

const BACKWARD =
  /(?:^|[.?!]\s+)([^.?!]{8,}?),\s*(?:saith|says)\s+the\s+(?:LORD|Lord)(?:\s+God)?(?:\s+of\s+hosts)?/g

const CONTINUES =
  /^(?:Thou\b|Thee\b|Ye\b|You\b|Thy\b|Your\b|I\b|My\b|Mine\b|Me\b|Let\b|Behold\b|Hear\b|Remember\b|Honou?r\b|Six days\b|Neither\b|Nor\b|For I\b|For thou\b|For ye\b|For the LORD\b|When thou\b|When ye\b|And if\b|If thou\b|If ye\b|And thou\b|And ye\b|And I\b|But I\b|But thou\b|Yet I\b|Now therefore\b|Therefore\b|Wherefore\b|Fear not\b|Verily\b|Be\b|Go\b|Come\b|Take\b|Speak\b|Write\b|Rise\b|Say\b|Tell\b|See,\b|O\b|Ah\b|Woe\b|Blessed\b)/

const NARRATIVE =
  /^(?:After this|After these|In the|In those|At that|These are|This is|The vision|The burden|The words of|The word of|The book of|And it came|Now it came|And these are|And all the|And the people|And Moses|And Aaron|And Pharaoh|And Noah|And Abraham|And Isaac|And Jacob|And Joseph|And David|And Solomon|And Adam|And Eve|And there |And it |And God (?:saw|made|created|divided|set|formed|planted|took|put|rested|ended|finished|walked|caused|brought|gave)|And the (?:evening|morning)\b)/

const QUOTE_INTRO =
  /(?:thus\s+(?:says|saith)\s+(?:the\s+)?(?:lord|god)|(?:says|saith|declares)\s+(?:the\s+)?(?:lord|god)|(?:god|the\s+lord(?:\s+god)?|jesus(?:\s+christ)?|christ|the\s+father|the\s+holy\s+spirit|the\s+spirit|the\s+holy\s+ghost|the\s+angel\s+of\s+(?:the\s+)?(?:lord|god)|a\s+voice(?:\s+\w+){0,10})\s+(?:answered\s+)?(?:said|says|saith|saying|spoke|spake|spoken|called|cried|asked|replied|told|declared|commanded|answered))\b[^“”"']{0,60}$/i

const HE_SAID = /^(?:And |Moreover |Then |So )?he said(?:\s+unto\s+(?:him|her|them))?\s*,\s*/

export function unionRanges(groups: Range[][]): Range[] {
  const all = groups.flat().filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out: Range[] = []
  for (const [start, end] of all) {
    const last = out[out.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else out.push([start, end])
  }
  return out
}

export function markDivine(verses: string[]): Range[][] {
  const quoted = verses.reduce((sum, verse) => sum + (verse.match(/[“”]/g)?.length ?? 0), 0) > 12
  const marked = quoted ? markQuoted(verses) : markPlain(verses)
  return marked.map((ranges, index) => clipRanges(ranges, verses[index]?.length ?? 0))
}

function clipRanges(ranges: Range[], length: number): Range[] {
  return unionRanges([ranges.map(([start, end]) => [Math.max(0, start), Math.min(length, end)] as Range)])
}

function speechStart(text: string, end: number): number {
  const rest = text.slice(end)
  const formula = rest.match(/^(?:\s+that\b[\s\S]{0,280}?)?,\s*(?=(?:Fear|I\b|Behold|Hear|Thou|Let|Be\b|Go\b|Come|Ah\b|Woe|For I|Therefore|Arise|Comfort|Surely|Draw|Put)\b)/)
  if (formula) return end + formula[0].length
  const skipped = rest.match(/^(?:\s+(?:unto|to)\s+[^,;:]{1,80}|\s+all\s+these\s+words)?(?:,\s*saying)?\s*,\s*/)
  if (skipped) return end + skipped[0].length
  return end
}

function closerAt(text: string, from: number): number | null {
  const slice = text.slice(from)
  const patterns = [
    /[:;]\s+and\s+there\s+(?:was|were)\b/,
    /[:;]\s+and\s+it\s+was\s+so\b/,
    /[:;]\s+and\s+God\s+(?:saw|made|created|divided|set|blessed|called|formed|planted)\b/,
    /[:;]\s+and\s+the\s+(?:evening|morning)\b/,
    /\band\s+(?:he|she|they)\s+said\b/,
    /\b(?:Moses|Aaron|Pharaoh|Noah|Abraham|Isaac|Jacob|Joseph|David|Solomon|Peter|Adam|the serpent|the woman|the man|the people)\s+(?:answered\b[^.]{0,40}?\bsaid|said)\b/,
    /\.\s+And\s+(?:Moses|Aaron|Pharaoh|Noah|Abraham|Isaac|Jacob|Joseph|David|Solomon|Peter|Adam|the)\b/i,
  ]
  let best: number | null = null
  for (const pattern of patterns) {
    const found = new RegExp(pattern.source, 'i').exec(slice)
    if (!found) continue
    const at = from + found.index
    if (best == null || at < best) best = at
  }
  return best
}

function continues(next: string | undefined): boolean {
  if (!next) return false
  const text = next.trim()
  if (NARRATIVE.test(text)) return false
  return CONTINUES.test(text)
}

const GOD_HE =
  /^(?:And |Moreover |Then |So )?he said(?:\s+unto\s+(?:him|her|them))?\s*,\s*(?:I am\b|I will\b|I have\b|I the\b|I AM\b|Thou\b|Draw\b|Put\b|Fear\b|Let\b|Behold\b|Go\b|Come\b|Surely\b|Now\b|See\b|Take\b|Speak\b|Tell\b|Arise\b)/

function keepSpeaking(speech: string, end: number, next: string | undefined, full: string): boolean {
  if (end < full.length) {
    const reply = full.slice(end)
    if (/\b(?:Moses|Aaron|Pharaoh|Noah|Abraham|Isaac|Jacob|Joseph|David|Solomon|Peter|Adam|the serpent|the woman|the man|the people)\s+(?:answered\b[^.]{0,20}?\bsaid|said)\b/.test(reply)) return false
    return /^\s*and\s+(?:he|she)\s+said,\s*(?:Here am I|Here I am)\b/i.test(reply)
  }
  if (/\?\s*$/.test(speech.trim())) return false
  const following = next?.trim() ?? ''
  if (!following || NARRATIVE.test(following)) return false
  if (CONTINUES.test(following)) return true
  return GOD_HE.test(following)
}

function markPlain(verses: string[]): Range[][] {
  const out: Range[][] = verses.map(() => [])
  let godHe = false
  for (let index = 0; index < verses.length; index += 1) {
    const text = verses[index]
    const next = verses[index + 1]
    const spans: Range[] = []
    const he = text.match(HE_SAID)
    if (godHe && continues(text) && !he) {
      const end = closerAt(text, 0) ?? text.length
      if (end > 0) spans.push([0, end])
      godHe = keepSpeaking(text.slice(0, end), end, next, text)
    } else if (godHe && he && GOD_HE.test(text)) {
      const start = he[0].length
      const end = closerAt(text, start) ?? text.length
      if (end > start) spans.push([start, end])
      godHe = keepSpeaking(text.slice(start, end), end, next, text)
    } else if (he) {
      godHe = false
    }
    for (const found of text.matchAll(FORWARD)) {
      const at = found.index ?? 0
      if (spans.some(([start, end]) => at >= start && at < end)) continue
      const start = speechStart(text, at + found[0].length)
      if (spans.some(([spanStart, end]) => start >= spanStart && start < end)) continue
      const end = closerAt(text, start) ?? text.length
      if (end > start) spans.push([start, end])
      godHe = keepSpeaking(text.slice(start, end), end, next, text)
    }
    if (!spans.length) {
      for (const found of text.matchAll(BACKWARD)) {
        const words = found[1]
        if (!words || /thus\s+(?:saith|says)/i.test(words)) continue
        const at = (found.index ?? 0) + found[0].indexOf(words)
        spans.push([at, at + words.length])
      }
    }
    out[index] = unionRanges([spans])
  }
  return out
}

type Frame = { verse: number; index: number; divine: boolean; kind: 'double' | 'single' | 'straight' }

function markQuoted(verses: string[]): Range[][] {
  const out: Range[][] = verses.map(() => [])
  const stack: Frame[] = []
  const openAt = (verse: number, index: number, kind: Frame['kind']) => {
    const divine = Boolean(stack.at(-1)?.divine) || introBefore(verses, verse, index)
    stack.push({ verse, index: index + 1, divine, kind })
  }
  const closeAt = (verse: number, index: number) => {
    const frame = stack.pop()
    if (!frame?.divine) return
    addSpan(out, verses, frame.verse, frame.index, verse, index)
  }
  for (let verse = 0; verse < verses.length; verse += 1) {
    const text = verses[verse]
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index]
      if (char === '“' || char === '"') {
        if (char === '"' && stack.at(-1)?.kind === 'straight') closeAt(verse, index)
        else openAt(verse, index, char === '"' ? 'straight' : 'double')
        continue
      }
      if (char === '”') {
        closeAt(verse, index)
        continue
      }
      if (char === '‘') {
        openAt(verse, index, 'single')
        continue
      }
      if (char === '’' && stack.at(-1)?.kind === 'single') closeAt(verse, index)
    }
  }
  const last = verses.length - 1
  while (stack.length) {
    const frame = stack.pop()
    if (frame?.divine && last >= 0) addSpan(out, verses, frame.verse, frame.index, last, verses[last].length)
  }
  return out.map((ranges) => unionRanges([ranges]))
}

function introBefore(verses: string[], verse: number, index: number): boolean {
  let sample = verses[verse].slice(Math.max(0, index - 180), index)
  if (sample.length < 180 && verse > 0) {
    const prev = verses[verse - 1]
    sample = `${prev.slice(Math.max(0, prev.length - (180 - sample.length)))} ${sample}`
  }
  return QUOTE_INTRO.test(sample)
}

function addSpan(out: Range[][], verses: string[], verse: number, start: number, endVerse: number, end: number) {
  if (verse === endVerse) {
    if (end > start) out[verse].push([start, end])
    return
  }
  if (start < verses[verse].length) out[verse].push([start, verses[verse].length])
  for (let cursor = verse + 1; cursor < endVerse; cursor += 1) {
    if (verses[cursor].length) out[cursor].push([0, verses[cursor].length])
  }
  if (end > 0) out[endVerse].push([0, end])
}

export function godSlices(text: string, offset: number, ranges: Range[] | undefined): { text: string; god: boolean }[] {
  if (!text) return []
  if (!ranges?.length) return [{ text, god: false }]
  const cuts = new Set<number>([0, text.length])
  for (const [start, end] of ranges) {
    const from = Math.max(0, start - offset)
    const to = Math.min(text.length, end - offset)
    if (from < to) {
      cuts.add(from)
      cuts.add(to)
    }
  }
  const points = [...cuts].sort((a, b) => a - b)
  const parts: { text: string; god: boolean }[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    const god = ranges.some(([start, end]) => offset + from >= start && offset + from < end)
    const slice = text.slice(from, to)
    if (slice) parts.push({ text: slice, god })
  }
  return parts
}

export type DivineBook = Record<string, Record<string, Range[]>>

const divineCache = new Map<string, Promise<DivineBook>>()

export function loadDivine(translation: 'kjv' | 'web', book: string): Promise<DivineBook> {
  const key = `${translation}/${book}`
  let pending = divineCache.get(key)
  if (!pending) {
    pending = fetch(`/data/divine/${translation}/${book}.json`)
      .then((response) => (response.ok ? response.json() as Promise<DivineBook> : {}))
      .catch(() => ({}))
    divineCache.set(key, pending)
  }
  return pending
}

export function verseGod(file: DivineBook | null | undefined, chapter: number, verse: number): Range[] {
  return file?.[String(chapter)]?.[String(verse)] ?? []
}
