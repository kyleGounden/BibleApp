import { useSyncExternalStore } from 'react'
import { loadChapter, plain, type Translation, type Verse } from './bible'
import { bookName, formatRef, neighbor, verseId } from './canon'
import { go } from './router'
import {
  clipIsReady,
  followClip,
  followerCount,
  onStudioProgress,
  pauseClip,
  playClip,
  prepareClip,
  primeStudioAudio,
  resumeClip,
  stopClip,
  studioId,
  warmupStudio,
  type StudioVoiceId,
} from './studioVoice'

export const VOICE_RATES = [0.8, 1, 1.25, 1.5] as const

export type VoiceStatus = 'idle' | 'playing' | 'paused'
export type SleepChoice = 'off' | 15 | 30 | 'end'
export type VoiceOption = { name: string; lang: string }

export type ScriptLine = {
  key: string
  label: string
  text: string
  book?: string
  chapter?: number
  verse?: number
  href?: string
  lang?: string
}

export type VoiceSnapshot = {
  status: VoiceStatus
  flow: boolean
  rate: number
  supported: boolean
  translation: Translation | null
  book: string | null
  chapter: number | null
  verse: number | null
  charIndex: number
  error: string
  scriptKey: string
  lineKey: string
  title: string
  label: string
  href: string | null
  index: number
  total: number
  voiceName: string
  voices: VoiceOption[]
  sleep: SleepChoice
  chapterMode: boolean
  phraseBefore: string
  phraseWord: string
  phraseAfter: string
  notice: string
}

type Piece = { text: string; start: number }

const VOICE_KEY = 'scripture.voice'
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

const listeners = new Set<() => void>()

let status: VoiceStatus = 'idle'
let flow = true
let rate = 1
let voiceName = ''
let sleep: SleepChoice = 'off'
let translation: Translation | null = null
let book: string | null = null
let chapter: number | null = null
let verse: number | null = null
let charIndex = 0
let error = ''
let scriptKey = ''
let lineKey = ''
let title = ''
let label = ''
let href: string | null = null
let chapterMode = false
let follow = false
let session = 0
let token = 0
let ticket = 0
let lines: ScriptLine[] = []
let index = 0
let stopAt: number | null = null
let upcoming: Promise<ScriptLine[] | null> | null = null
let speakTimer = 0
let sleepTimer = 0
let lineStamp = 0
let fallbackArm = 0
let fallbackTimer = 0
let stallTimer = 0
let heardBoundary = false
let pending: Pending | null = null
let notice = ''
let studioDown = false
let preparing = false
let undoFollow: (() => void) | null = null
let cancelStamp = 0
const heldUtterances = new Set<SpeechSynthesisUtterance>()
const rejectedVoices = new Set<string>()
const DEFAULT_STUDIO: StudioVoiceId = 'af_heart'

type Pending = { kind: 'part'; at: number } | { kind: 'verse' }
type Shaped = { text: string; map: number[] }

function readPrefs(): { flow: boolean; rate: number; voiceName: string } {
  if (typeof localStorage === 'undefined') return { flow: true, rate: 1, voiceName: '' }
  try {
    const raw = localStorage.getItem(VOICE_KEY)
    if (!raw) return { flow: true, rate: 1, voiceName: '' }
    const parsed = JSON.parse(raw) as { flow?: unknown; rate?: unknown; voice?: unknown }
    const saved = typeof parsed.rate === 'number' && (VOICE_RATES as readonly number[]).includes(parsed.rate) ? parsed.rate : 1
    return { flow: parsed.flow !== false, rate: saved, voiceName: typeof parsed.voice === 'string' ? parsed.voice : '' }
  } catch {
    return { flow: true, rate: 1, voiceName: '' }
  }
}

function savePrefs(): void {
  try {
    localStorage.setItem(VOICE_KEY, JSON.stringify({ flow, rate, voice: voiceName }))
  } catch {
    /* private mode */
  }
}

const prefs = readPrefs()
flow = prefs.flow
rate = prefs.rate
voiceName = prefs.voiceName
if (!voiceName || studioId(voiceName)) warmupStudio()

function phraseAround(text: string, at: number): { before: string; word: string; after: string } {
  const words = [...text.matchAll(/\S+/g)]
  if (!words.length) return { before: '', word: '', after: '' }
  let atWord = 0
  for (let n = 0; n < words.length; n += 1) {
    const start = words[n].index ?? 0
    if (start <= at) atWord = n
    else break
  }
  const word = words[atWord]?.[0] ?? ''
  const before = words.slice(Math.max(0, atWord - 3), atWord).map((item) => item[0]).join(' ')
  const after = words.slice(atWord + 1, atWord + 5).map((item) => item[0]).join(' ')
  return { before, word, after }
}

function collectVoices(): VoiceOption[] {
  if (!supported) return []
  return window.speechSynthesis.getVoices()
    .filter((voice) => /^(en|he|el|gr)/i.test(voice.lang))
    .map((voice) => ({ voice, score: scoreVoice(voice) }))
    .sort((a, b) => b.score - a.score)
    .map(({ voice }) => ({ name: voice.name, lang: voice.lang }))
}

let voiceList: VoiceOption[] = []

function refreshVoices(): void {
  voiceList = collectVoices()
}

function capture(): VoiceSnapshot {
  const phrase = phraseAround(lines[index]?.text ?? '', charIndex)
  return {
    status,
    flow,
    rate,
    supported,
    translation,
    book,
    chapter,
    verse,
    charIndex,
    error,
    scriptKey,
    lineKey,
    title,
    label,
    href,
    index,
    total: lines.length,
    voiceName,
    voices: voiceList,
    sleep,
    chapterMode,
    phraseBefore: phrase.before,
    phraseWord: phrase.word,
    phraseAfter: phrase.after,
    notice,
  }
}

let snapshot = capture()

function publish(): void {
  snapshot = capture()
  syncMedia()
  listeners.forEach((listener) => listener())
}

function publishAt(next: number): void {
  if (next === charIndex) return
  charIndex = next
  publish()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getVoice(): VoiceSnapshot {
  return snapshot
}

export function useVoice(): VoiceSnapshot {
  return useSyncExternalStore(subscribe, getVoice, getVoice)
}

function wordStarts(text: string): number[] {
  return [...text.matchAll(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)].flatMap((match) =>
    match.index == null ? [] : [match.index],
  )
}

function rewindToWord(text: string, at: number): number {
  const starts = wordStarts(text)
  let mark = starts[0] ?? 0
  for (const start of starts) {
    if (start <= at) mark = start
    else break
  }
  return mark
}

function sentencePieces(text: string): Piece[] {
  const rough: Piece[] = []
  for (const match of text.matchAll(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g)) {
    if (!match[0].trim() || match.index == null) continue
    rough.push({ text: match[0], start: match.index })
  }
  if (!rough.length && text.trim()) rough.push({ text, start: 0 })
  return rough
}

function splitLong(part: Piece, limit: number, keepPhrase: boolean): Piece[] {
  if (part.text.length <= limit) return [part]
  const out: Piece[] = []
  const firstComma = part.text.indexOf(', ')
  let cursor = 0
  while (cursor < part.text.length) {
    let end = Math.min(part.text.length, cursor + limit)
    if (end < part.text.length) {
      const slice = part.text.slice(cursor, end)
      const commaAt = slice.lastIndexOf(', ')
      const semiAt = slice.lastIndexOf('; ')
      const spaceAt = slice.lastIndexOf(' ')
      let breakAt = Math.max(commaAt, semiAt, spaceAt)
      if (keepPhrase && firstComma >= cursor && commaAt === firstComma - cursor) {
        breakAt = Math.max(semiAt, spaceAt)
      }
      if (breakAt > 40) end = cursor + breakAt + 1
    }
    const piece = part.text.slice(cursor, end)
    if (piece.trim()) out.push({ text: piece, start: part.start + cursor })
    if (end <= cursor) break
    cursor = end
  }
  return out.length ? out : [part]
}

function chunks(text: string, limit: number): Piece[] {
  const sentences = sentencePieces(text)
  if (!sentences.length) return [{ text, start: 0 }]
  if (limit < 160) return sentences.flatMap((sentence) => splitLong(sentence, limit, false))
  const packed: Piece[] = []
  let start = sentences[0].start
  let end = start
  const flush = () => {
    if (end <= start) return
    packed.push(...splitLong({ text: text.slice(start, end), start }, limit, true))
  }
  for (const sentence of sentences) {
    const sentenceEnd = sentence.start + sentence.text.length
    if (end > start && sentenceEnd - start > limit) {
      flush()
      start = sentence.start
    }
    end = sentenceEnd
  }
  flush()
  return packed.length ? packed : [{ text, start: 0 }]
}

function clearFallback(): void {
  window.clearTimeout(fallbackArm)
  window.clearInterval(fallbackTimer)
  fallbackArm = 0
  fallbackTimer = 0
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name
  const lang = voice.lang.toLowerCase().replace('_', '-')
  let score = 0
  if (lang.startsWith('en-us')) score += 48
  else if (lang.startsWith('en-gb')) score += 44
  else score += 24
  if (/natural/i.test(name)) score += 120
  if (/neural/i.test(name)) score += 120
  if (/premium/i.test(name)) score += 90
  if (/enhanced/i.test(name)) score += 70
  if (/google uk english female/i.test(name)) score += 64
  else if (/google uk english male/i.test(name)) score += 56
  else if (/google us english/i.test(name)) score += 40
  else if (/google/i.test(name)) score += 28
  if (/\b(aria|jenny|guy|sara|sonia|libby|ryan|ana|michelle|ava|allison|samantha|daniel|serena|moira|karen|nicky|aaron|nathan)\b/i.test(name)) {
    score += 18
  }
  if (/espeak|compact/i.test(name)) score -= 100
  if (/\b(david|zira|mark|hazel)\b/i.test(name) && !/natural|neural/i.test(name)) score -= 40
  // Network voices (the Google ones in Chrome) wait on a round trip and then
  // cut out. A voice that lives on the device starts immediately and holds.
  if (voice.localService) score += 160
  else score -= 120
  return score
}

function langHead(lang: string): string {
  return lang.toLowerCase().replace('_', '-').split('-')[0] ?? ''
}

function pickVoice(prefer?: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const want = prefer ? langHead(prefer) : ''
  if (want === 'he' || want === 'el' || want === 'gr') {
    const aliases = want === 'he' ? ['he'] : ['el', 'gr']
    const native = voices.find((voice) => aliases.includes(langHead(voice.lang)) && !rejectedVoices.has(voice.name))
    if (native) return native
  }
  if (voiceName) {
    const saved = voices.find((voice) => voice.name === voiceName && !rejectedVoices.has(voice.name))
    if (saved) return saved
  }
  let best: SpeechSynthesisVoice | null = null
  let bestScore = -1
  for (const voice of voices) {
    if (!/^en([-_]|$)/i.test(voice.lang) || rejectedVoices.has(voice.name)) continue
    const score = scoreVoice(voice)
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return best
}

function setNotice(next: string): void {
  if (notice === next) return
  notice = next
  publish()
}

function foreignScript(line: ScriptLine): boolean {
  const head = line.lang ? langHead(line.lang) : ''
  return head === 'he' || head === 'el' || head === 'gr'
}

function chosenStudio(): StudioVoiceId | null {
  if (studioDown) return null
  if (!voiceName) return DEFAULT_STUDIO
  return studioId(voiceName)
}

function wantsStudio(line: ScriptLine): boolean {
  return chosenStudio() != null && !foreignScript(line)
}

function sourceAt(shaped: Shaped, spokenIndex: number): number {
  if (!shaped.map.length) return 0
  if (spokenIndex <= 0) return shaped.map[0]
  if (spokenIndex >= shaped.map.length) return shaped.map[shaped.map.length - 1]
  return shaped.map[spokenIndex]
}

// The printed text is written for the eye. Speech needs sentence breaks, real
// contractions, and "LORD" said as a word rather than shouted.
function shapeSpeech(input: string): Shaped {
  const text: string[] = []
  const map: number[] = []
  let liftNext = false
  const emit = (ch: string, source: number) => {
    text.push(ch)
    map.push(source)
  }

  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === '\u2019' || ch === '\u2018' || ch === '\u02BC' || ch === "'") {
      const tail = input.slice(i + 1).match(/^(\s+)(t|s|ll|ve|re|d|m|em)\b/i)
      if (tail && /[A-Za-z]/.test(input[i - 1] ?? '')) {
        emit("'", i)
        const endAt = i + 1 + tail[1].length
        for (let k = 0; k < tail[2].length; k += 1) emit(tail[2][k], endAt + k)
        i = endAt + tail[2].length
        continue
      }
      emit("'", i)
      i += 1
      continue
    }
    if ('"“”«»„'.includes(ch)) {
      i += 1
      continue
    }
    if (ch === '\u2014' || ch === '\u2013' || ch === '\u2026') {
      emit(',', i)
      emit(' ', i)
      i += 1
      continue
    }
    if (ch === '.' && input[i + 1] === '.' && input[i + 2] === '.') {
      emit(',', i)
      emit(' ', i)
      i += 3
      continue
    }
    if (ch === ';') {
      emit('.', i)
      emit(' ', i)
      liftNext = true
      i += 1
      continue
    }
    if (ch === ':') {
      emit(',', i)
      emit(' ', i)
      i += 1
      continue
    }
    if ((ch === '.' || ch === '!' || ch === '?') && /[A-Za-z]/.test(input[i + 1] ?? '')) {
      emit(ch, i)
      emit(' ', i)
      liftNext = true
      i += 1
      continue
    }
    if (/[A-Z]/.test(ch) && (i === 0 || !/[A-Za-z]/.test(input[i - 1] ?? ''))) {
      let j = i + 1
      while (j < input.length && /[A-Z]/.test(input[j])) j += 1
      if (j - i >= 2 && (j >= input.length || !/[A-Za-z]/.test(input[j]))) {
        emit(input[i], i)
        liftNext = false
        for (let k = i + 1; k < j; k += 1) emit(input[k].toLowerCase(), k)
        i = j
        continue
      }
    }
    if (liftNext && /[a-z]/.test(ch)) {
      emit(ch.toUpperCase(), i)
      liftNext = false
      i += 1
      continue
    }
    if (!/\s/.test(ch)) liftNext = false
    emit(ch, i)
    i += 1
  }

  const collapsed: string[] = []
  const collapsedMap: number[] = []
  let spaced = true
  for (let n = 0; n < text.length; n += 1) {
    if (/\s/.test(text[n])) {
      if (spaced) continue
      collapsed.push(' ')
      collapsedMap.push(map[n])
      spaced = true
      continue
    }
    spaced = false
    collapsed.push(text[n])
    collapsedMap.push(map[n])
  }
  while (collapsed.length && collapsed[collapsed.length - 1] === ' ') {
    collapsed.pop()
    collapsedMap.pop()
  }
  const spoken = collapsed.join('')
  if (/selah$/i.test(spoken) && !/[.!?]$/.test(spoken)) {
    const anchor = collapsedMap[collapsedMap.length - 1] ?? 0
    collapsed.push('.')
    collapsedMap.push(anchor)
  }
  return { text: collapsed.join(''), map: collapsedMap }
}

function delivery(text: string, baseRate: number): { rate: number; pitch: number } {
  const trimmed = text.trim()
  const single = trimmed.length < 220 && (trimmed.match(/[.!?]/g)?.length ?? 0) <= 1
  let pitch = 1
  if (single && /\?$/.test(trimmed)) pitch = 1.04
  else if (single && /!$/.test(trimmed)) pitch = 1.02
  return {
    rate: Math.min(1.65, Math.max(0.72, Math.round(baseRate * 100) / 100)),
    pitch: Math.min(1.14, Math.max(0.86, Math.round(pitch * 100) / 100)),
  }
}

function pauseMs(kind: 'question' | 'exclaim' | 'sentence' | 'verse', engine: 'device' | 'studio'): number {
  // The device voice already rests on punctuation. Extra waits sound like dropouts.
  if (engine === 'device') return kind === 'verse' ? 50 : 0
  const base = kind === 'verse' ? 180 : kind === 'question' ? 120 : kind === 'exclaim' ? 90 : 80
  return Math.round(base / Math.max(rate, 0.85))
}

function endingOf(text: string): 'question' | 'exclaim' | 'sentence' {
  const trimmed = text.trim()
  if (/\?$/.test(trimmed)) return 'question'
  if (/!$/.test(trimmed)) return 'exclaim'
  return 'sentence'
}

function tune(utterance: SpeechSynthesisUtterance, text: string, baseRate = rate, prefer?: string): SpeechSynthesisVoice | null {
  const chosen = pickVoice(prefer)
  const want = prefer ? langHead(prefer) : ''
  const chosenHead = chosen ? langHead(chosen.lang) : ''
  const native = want === 'he' ? chosenHead === 'he' : want === 'el' || want === 'gr' ? chosenHead === 'el' || chosenHead === 'gr' : false
  const slower = Boolean(want && (want === 'he' || want === 'el' || want === 'gr') && !native)
  const contour = delivery(text, slower ? Math.min(baseRate, 0.85) : baseRate)
  utterance.rate = contour.rate
  utterance.pitch = contour.pitch
  utterance.lang = chosen?.lang || 'en-US'
  if (chosen) utterance.voice = chosen
  return chosen
}

function afterBreath(ms: number, next: Pending, run: () => void): void {
  const id = token
  if (ms <= 0) {
    if (id !== token || status !== 'playing') return
    run()
    return
  }
  pending = next
  window.clearTimeout(speakTimer)
  speakTimer = window.setTimeout(() => {
    if (id !== token || status !== 'playing') return
    pending = null
    run()
  }, ms)
}

function scriptureLine(bookId: string, chapterNumber: number, verseNumber: number, text: string): ScriptLine {
  const id = verseId(bookId, chapterNumber, verseNumber)
  return {
    key: id,
    label: formatRef(id),
    text,
    book: bookId,
    chapter: chapterNumber,
    verse: verseNumber,
    href: `/read/${bookId}/${chapterNumber}/${verseNumber}`,
  }
}

function linesFrom(bookId: string, chapterNumber: number, verses: Record<string, Verse> | undefined, from: number, to: number | null): ScriptLine[] {
  if (!verses) return []
  return Object.keys(verses)
    .map(Number)
    .filter((number) => Number.isFinite(number) && number >= from && (to == null || number <= to))
    .sort((a, b) => a - b)
    .map((number) => scriptureLine(bookId, chapterNumber, number, plain(verses[String(number)])))
    .filter((line) => line.text.trim().length > 0)
}

async function chapterLines(bookId: string, chapterNumber: number, from: number): Promise<ScriptLine[]> {
  if (!translation) return []
  const file = await loadChapter(translation, bookId, chapterNumber)
  return linesFrom(bookId, chapterNumber, file.chapters[String(chapterNumber)], from, null)
}

function queueNext(): void {
  if (!chapterMode || !flow || sleep === 'end' || upcoming || status !== 'playing') return
  const line = lines[index]
  if (!line?.book || line.chapter == null || index < lines.length - 1) return
  const next = neighbor(line.book, line.chapter, 1)
  if (!next || !translation) return
  const translationNow = translation
  upcoming = loadChapter(translationNow, next.book, next.chapter)
    .then((file) => linesFrom(next.book, next.chapter, file.chapters[String(next.chapter)], 1, null))
    .catch(() => null)
}

async function takeNext(): Promise<ScriptLine[] | null> {
  const line = lines[lines.length - 1]
  if (!line?.book || line.chapter == null || !translation) return null
  const next = neighbor(line.book, line.chapter, 1)
  if (!next) return null
  if (!upcoming) queueNext()
  const waiting = upcoming
  upcoming = null
  const loaded = waiting ? await waiting : null
  if (loaded?.length) return loaded
  try {
    const file = await loadChapter(translation, next.book, next.chapter)
    const more = linesFrom(next.book, next.chapter, file.chapters[String(next.chapter)], 1, null)
    return more.length ? more : null
  } catch (err) {
    error = err instanceof Error ? err.message : 'The next chapter did not load, so reading stopped.'
    return null
  }
}

function applyLine(line: ScriptLine | undefined): void {
  if (!line) {
    book = null
    chapter = null
    verse = null
    lineKey = ''
    label = ''
    href = null
    return
  }
  book = line.book ?? null
  chapter = line.chapter ?? null
  verse = line.verse ?? null
  lineKey = line.key
  label = line.label
  href = line.href ?? (line.book && line.chapter != null ? `/read/${line.book}/${line.chapter}${line.verse ? `/${line.verse}` : ''}` : null)
}

function readingHere(): boolean {
  const hash = window.location.hash.replace(/^#/, '')
  return hash === '/read' || hash.startsWith('/read/')
}

function syncMedia(): void {
  const media = navigator.mediaSession
  if (!media) return
  const heading = label || title || 'Scripture'
  try {
    if ('MediaMetadata' in window) {
      media.metadata = new MediaMetadata({ title: heading, artist: title || 'Scripture' })
    }
    media.playbackState = status === 'playing' ? 'playing' : status === 'paused' ? 'paused' : 'none'
  } catch {
    /* the browser has no media session */
  }
}

function settle(message = ''): void {
  session += 1
  token += 1
  pending = null
  window.clearTimeout(speakTimer)
  window.clearTimeout(sleepTimer)
  clearFallback()
  lines = []
  index = 0
  stopAt = null
  upcoming = null
  charIndex = 0
  status = 'idle'
  translation = null
  book = null
  chapter = null
  verse = null
  scriptKey = ''
  lineKey = ''
  title = ''
  label = ''
  href = null
  chapterMode = false
  follow = false
  sleep = 'off'
  error = message
  notice = ''
  preparing = false
  clearStall()
  clearFollow()
  stopClip()
  silenceEngine()
  publish()
}

function armFallback(id: number, spoken: string, locate: (spokenIndex: number) => number): void {
  clearFallback()
  heardBoundary = false
  const starts = wordStarts(spoken)
  if (starts.length < 2) return
  fallbackArm = window.setTimeout(() => {
    if (id !== token || heardBoundary) return
    let step = 0
    fallbackTimer = window.setInterval(() => {
      if (id !== token || heardBoundary || status !== 'playing') {
        clearFallback()
        return
      }
      step += 1
      if (step >= starts.length) {
        clearFallback()
        return
      }
      publishAt(locate(starts[step]))
    }, Math.max(140, 420 / rate))
  }, 360)
}

type SpokenPiece = {
  line: ScriptLine
  lineIndex: number
  parts: Piece[]
  partAt: number
  shaped: Shaped
  place: (spokenIndex: number) => number
  id: number
  done: boolean
  engine: 'device' | 'studio'
  utterance?: SpeechSynthesisUtterance
}

function chunkLimit(studio: boolean): number {
  if (studio) return 180
  // One short sentence. Chromium drops a long utterance and never reports the end.
  return Math.max(80, Math.round(12 * Math.max(rate, 0.75) * 7))
}

function clearStall(): void {
  window.clearTimeout(stallTimer)
  stallTimer = 0
}

function holdUtterance(utterance: SpeechSynthesisUtterance): void {
  heldUtterances.add(utterance)
  const release = () => heldUtterances.delete(utterance)
  utterance.addEventListener('end', release)
  utterance.addEventListener('error', release)
}

function silenceEngine(): void {
  if (!supported) return
  const synth = window.speechSynthesis
  // cancel() while the engine is idle makes the next speak() wait or never start.
  if (!synth.speaking && !synth.pending && !synth.paused) return
  synth.cancel()
  synth.resume()
  cancelStamp = performance.now()
}

function runSpeech(run: () => void): void {
  // Chrome drops a speak() that shares a turn with cancel(). The next turn is enough.
  if (performance.now() - cancelStamp < 80) {
    window.setTimeout(run, 0)
    return
  }
  run()
}

function primeEngine(): void {
  if (!supported) return
  try {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.resume()
  } catch {
    /* the engine comes up on the next speak */
  }
}

function armStall(piece: SpokenPiece): void {
  clearStall()
  const ms = Math.min(20000, Math.max(6000, (piece.shaped.text.length / (11 * Math.max(rate, 0.75))) * 1000 + 4000))
  stallTimer = window.setTimeout(() => {
    if (piece.done || piece.id !== token || status !== 'playing') return
    piece.done = true
    clearFallback()
    silenceEngine()
    const next = piece.parts[piece.partAt + 1]
    if (next) {
      charIndex = next.start
      speakChunk(false)
      return
    }
    void onwards()
  }, ms)
}

const studioCue = new Set<string>()

function cueKey(piece: SpokenPiece): string {
  return `${piece.id}:${piece.lineIndex}:${piece.partAt}`
}

function clearStudioCue(): void {
  studioCue.clear()
}

function clearFollow(): void {
  clearStudioCue()
  const undo = undoFollow
  undoFollow = null
  undo?.()
}

function pieceFromParts(
  line: ScriptLine,
  lineIndex: number,
  parts: Piece[],
  partAt: number,
  fromChar: number,
  id: number,
  engine: 'device' | 'studio',
): SpokenPiece | null {
  const part = parts[partAt]
  if (!part) return null
  const local = Math.max(0, fromChar - part.start)
  const from = local <= 0 ? (wordStarts(part.text)[0] ?? 0) : rewindToWord(part.text, local)
  const spoken = part.text.slice(from)
  const shaped = shapeSpeech(spoken)
  if (!shaped.text) return null
  const place = (spokenIndex: number) => part.start + from + sourceAt(shaped, spokenIndex)
  return {
    line,
    lineIndex,
    parts,
    partAt,
    shaped,
    place,
    id,
    done: false,
    engine,
  }
}

function pieceAfter(piece: SpokenPiece): SpokenPiece | null {
  const nextPart = piece.parts[piece.partAt + 1]
  if (nextPart) return pieceFromParts(piece.line, piece.lineIndex, piece.parts, piece.partAt + 1, nextPart.start, piece.id, piece.engine)
  const nextIndex = piece.lineIndex + 1
  if (nextIndex >= lines.length) return null
  const line = lines[nextIndex]
  if (!line || pastRange(line)) return null
  if (piece.engine === 'studio' && (foreignScript(line) || !wantsStudio(line))) return null
  const parts = chunks(line.text, chunkLimit(piece.engine === 'studio'))
  return pieceFromParts(line, nextIndex, parts, 0, 0, piece.id, piece.engine)
}

function adoptPiece(piece: SpokenPiece): void {
  const at = piece.place(wordStarts(piece.shaped.text)[0] ?? 0)
  const moved = index !== piece.lineIndex
  index = piece.lineIndex
  applyLine(piece.line)
  charIndex = at
  if (moved && piece.partAt === 0) lineStamp = Date.now()
  publish()
  queueNext()
}

function finishPiece(piece: SpokenPiece): void {
  if (piece.done || piece.id !== token) return
  piece.done = true
  clearStall()
  clearFallback()
  const next = piece.parts[piece.partAt + 1]
  if (next) {
    afterBreath(pauseMs(endingOf(piece.shaped.text), piece.engine), { kind: 'part', at: next.start }, () => {
      charIndex = next.start
      speakChunk(false)
    })
    return
  }
  afterBreath(pauseMs('verse', piece.engine), { kind: 'verse' }, () => {
    void onwards()
  })
}

function prefetchStudio(voice: StudioVoiceId, piece: SpokenPiece): void {
  const texts: string[] = []
  let cursor = pieceAfter(piece)
  while (cursor && texts.length < 2) {
    if (cursor.shaped.text) texts.push(cursor.shaped.text)
    cursor = pieceAfter(cursor)
  }
  void (async () => {
    for (const text of texts) {
      try {
        await prepareClip(voice, rate, text)
      } catch {
        return
      }
    }
  })()
}

function speakPiece(piece: SpokenPiece): void {
  const utterance = new SpeechSynthesisUtterance(piece.shaped.text)
  piece.utterance = utterance
  holdUtterance(utterance)
  const chosen = tune(utterance, piece.shaped.text, rate, piece.line.lang)
  utterance.onstart = () => {
    if (piece.id !== token || piece.done || status !== 'playing') return
    adoptPiece(piece)
    armFallback(piece.id, piece.shaped.text, piece.place)
  }
  utterance.onboundary = (event) => {
    if (piece.id !== token || piece.done || event.name === 'sentence') return
    if (typeof event.charIndex !== 'number' || event.charIndex < 0) return
    heardBoundary = true
    clearFallback()
    publishAt(piece.place(event.charIndex))
  }
  utterance.onend = () => {
    if (piece.id !== token || piece.done) return
    clearStall()
    clearFallback()
    finishPiece(piece)
  }
  utterance.onerror = (event) => {
    if (piece.id !== token || piece.done) return
    const reason = String(event.error)
    if (reason === 'interrupted' || reason === 'canceled' || reason === 'cancelled') return
    clearStall()
    piece.done = true
    clearFallback()
    if (chosen && rejectedVoices.size < 4) {
      rejectedVoices.add(chosen.name)
      speakChunk(true)
      return
    }
    settle('Reading aloud stopped.')
  }
  const synth = window.speechSynthesis
  synth.resume()
  synth.speak(utterance)
  if (synth.paused) synth.resume()
  armStall(piece)
}

async function cueStudio(piece: SpokenPiece, voice: StudioVoiceId, markHanded: () => void): Promise<void> {
  if (piece.done || piece.id !== token || status !== 'playing') return
  const spec = pieceAfter(piece)
  if (!spec) return
  const key = cueKey(spec)
  if (studioCue.has(key)) return
  if (followerCount() >= 2) {
    window.setTimeout(() => {
      if (piece.id !== token || status !== 'playing') return
      void cueStudio(piece, voice, markHanded)
    }, 400)
    return
  }
  studioCue.add(key)
  let clip: Awaited<ReturnType<typeof prepareClip>>
  try {
    clip = await prepareClip(voice, rate, spec.shaped.text)
  } catch {
    studioCue.delete(key)
    return
  }
  if (piece.done || piece.id !== token || status !== 'playing') {
    studioCue.delete(key)
    return
  }
  let childHanded = false
  const gap = pauseMs(spec.partAt === 0 ? 'verse' : endingOf(piece.shaped.text), 'studio') / 1000
  const cancel = followClip(
    clip,
    (at) => {
      if (spec.id !== token || spec.done) return
      publishAt(spec.place(at))
    },
    () => {
      if (spec.id !== token || spec.done) return
      finishPiece(spec)
    },
    gap,
    () => {
      childHanded = true
      markHanded()
      if (spec.id !== token || status !== 'playing') return
      piece.done = true
      index = spec.lineIndex
      applyLine(spec.line)
      charIndex = spec.place(wordStarts(spec.shaped.text)[0] ?? 0)
      if (spec.partAt === 0) lineStamp = Date.now()
      publish()
      queueNext()
      void cueStudio(spec, voice, () => {
        childHanded = true
      })
    },
  )
  if (!cancel) {
    studioCue.delete(key)
    return
  }
  undoFollow = () => {
    const started = childHanded
    childHanded = false
    if (!started) cancel()
  }
  void cueStudio(spec, voice, () => {
    childHanded = true
  })
}

async function speakWithStudio(piece: SpokenPiece, voice: StudioVoiceId): Promise<void> {
  const { shaped, place, id } = piece
  preparing = true
  primeStudioAudio()
  if (!clipIsReady(voice, rate, shaped.text)) setNotice('Preparing the voice')
  const pendingClip = prepareClip(voice, rate, shaped.text)
  prefetchStudio(voice, piece)
  let handed = false
  try {
    const clip = await pendingClip
    if (id !== token || status !== 'playing') {
      if (id === token) preparing = false
      return
    }
    preparing = false
    setNotice('')
    playClip(
      clip,
      (at) => {
        if (id !== token || handed) return
        publishAt(place(at))
      },
      () => {
        if (id !== token || handed) return
        finishPiece(piece)
      },
    )
    void cueStudio(piece, voice, () => {
      handed = true
    })
  } catch {
    if (id !== token) return
    preparing = false
    studioDown = true
    setNotice('')
    error = 'The studio voice did not load, so this device is reading.'
    publish()
    if (status === 'playing') speakChunk(true)
  }
}

function speakChunk(interrupt = true): void {
  if (interrupt) {
    token += 1
    clearFollow()
    window.clearTimeout(speakTimer)
    clearFallback()
    clearStall()
    preparing = false
    stopClip()
    silenceEngine()
  } else {
    token += 1
  }
  pending = null
  const line = lines[index]
  if (!line || status !== 'playing' || !supported) return
  const voice = chosenStudio()
  const studio = Boolean(voice && wantsStudio(line))
  const parts = chunks(line.text, chunkLimit(studio))
  let partAt = 0
  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const end = partIndex + 1 < parts.length ? parts[partIndex + 1].start : line.text.length
    if (charIndex < end) {
      partAt = partIndex
      break
    }
    partAt = partIndex
  }
  const part = parts[partAt]
  if (!part) {
    void onwards()
    return
  }
  const piece = pieceFromParts(line, index, parts, partAt, Math.max(charIndex, part.start), token, studio ? 'studio' : 'device')
  if (!piece) {
    const next = parts[partAt + 1]
    if (next) {
      charIndex = next.start
      speakChunk(false)
      return
    }
    void onwards()
    return
  }
  if (partAt === 0 && charIndex <= (wordStarts(part.text)[0] ?? 0)) lineStamp = Date.now()
  applyLine(line)
  charIndex = piece.place(wordStarts(piece.shaped.text)[0] ?? 0)
  publish()
  queueNext()
  if (studio && voice) {
    void speakWithStudio(piece, voice)
    return
  }
  setNotice('')
  runSpeech(() => {
    if (piece.id !== token || status !== 'playing') return
    speakPiece(piece)
  })
}

function pastRange(line: ScriptLine | undefined): boolean {
  return stopAt != null && !flow && line?.verse != null && line.verse > stopAt
}

async function adoptChapter(run: number): Promise<boolean> {
  const more = await takeNext()
  if (run !== session || status !== 'playing') return false
  if (!more?.length) {
    settle(error)
    return false
  }
  lines = more
  index = 0
  charIndex = 0
  applyLine(lines[0])
  publish()
  const line = lines[0]
  if (follow && readingHere() && line?.book && line.chapter != null) {
    const path = `#/read/${line.book}/${line.chapter}`
    if (window.location.hash.toUpperCase() !== path.toUpperCase()) go(`/read/${line.book}/${line.chapter}`)
  }
  return run === session && status === 'playing'
}

async function onwards(): Promise<void> {
  const run = session
  index += 1
  if (index < lines.length && pastRange(lines[index])) {
    settle()
    return
  }
  if (index >= lines.length) {
    if (!(chapterMode && flow && sleep !== 'end')) {
      settle()
      return
    }
    const ok = await adoptChapter(run)
    if (!ok) return
  }
  if (run !== session || status !== 'playing') return
  charIndex = 0
  speakChunk(false)
}

function unsupported(message: string): boolean {
  if (supported) return false
  error = message
  publish()
  return true
}

function arm(nextTitle: string, nextKey: string): number {
  session += 1
  const run = session
  token += 1
  pending = null
  preparing = false
  window.clearTimeout(speakTimer)
  clearFallback()
  clearStall()
  clearFollow()
  stopClip()
  silenceEngine()
  primeEngine()
  upcoming = null
  error = ''
  notice = ''
  if (chosenStudio()) {
    primeStudioAudio()
    warmupStudio()
  }
  status = 'playing'
  title = nextTitle
  scriptKey = nextKey
  label = nextTitle
  charIndex = 0
  publish()
  return run
}

export function nextTicket(): number {
  ticket += 1
  return ticket
}

export async function startScript(input: {
  key: string
  title: string
  lines: ScriptLine[]
  translation?: Translation | null
  follow?: boolean
  ticket?: number
}): Promise<void> {
  if (input.ticket != null && input.ticket !== ticket) return
  if (unsupported('This browser cannot read aloud.')) return
  const run = arm(input.title, input.key)
  const ready = input.lines.filter((line) => line.text.trim())
  if (run !== session) return
  if (!ready.length) {
    settle('There is no text to read.')
    return
  }
  lines = ready
  index = 0
  charIndex = 0
  translation = input.translation ?? null
  chapterMode = false
  follow = Boolean(input.follow)
  stopAt = null
  applyLine(lines[0])
  publish()
  speakChunk()
}

export async function startVoice(input: {
  translation: Translation
  book: string
  chapter: number
  from: number
  to?: number
  verses?: Record<string, Verse>
}): Promise<void> {
  if (unsupported('This browser cannot read aloud.')) return
  const heading = `${bookName(input.book)} ${input.chapter}`
  const key = `read:${input.translation}:${input.book}:${input.chapter}:${input.from}:${input.to ?? 0}`
  const run = arm(heading, key)
  translation = input.translation
  book = input.book
  chapter = input.chapter
  verse = input.from
  chapterMode = true
  follow = true
  stopAt = !flow && input.to != null && input.to > input.from ? input.to : null
  const ready = input.verses ? linesFrom(input.book, input.chapter, input.verses, input.from, stopAt) : []
  if (ready.length) {
    lines = ready
    index = 0
    charIndex = 0
    applyLine(lines[0])
    speakChunk()
    return
  }
  publish()
  try {
    lines = await chapterLines(input.book, input.chapter, input.from)
    if (run !== session) return
    if (stopAt != null) lines = lines.filter((line) => line.verse == null || line.verse <= stopAt!)
    if (!lines.length) {
      settle('There is no text to read in this passage.')
      return
    }
    index = 0
    charIndex = 0
    applyLine(lines[0])
    speakChunk()
  } catch (err) {
    if (run !== session) return
    settle(err instanceof Error ? err.message : 'This chapter did not load.')
  }
}

export function pauseVoice(): void {
  if (status !== 'playing') return
  status = 'paused'
  preparing = false
  window.clearTimeout(speakTimer)
  clearFallback()
  clearStall()
  clearFollow()
  if (pauseClip()) {
    publish()
    return
  }
  token += 1
  setNotice('')
  silenceEngine()
  publish()
}

export function resumeVoice(): void {
  if (status !== 'paused') return
  status = 'playing'
  const next = pending
  pending = null
  if (!next && resumeClip()) {
    publish()
    return
  }
  publish()
  if (next?.kind === 'part') {
    charIndex = next.at
    speakChunk()
    return
  }
  if (next?.kind === 'verse') {
    void onwards()
    return
  }
  speakChunk()
}

export function stopVoice(): void {
  ticket += 1
  if (status === 'idle' && error === '') return
  settle()
}

export function toggleVoiceFlow(): void {
  flow = !flow
  if (!flow) upcoming = null
  savePrefs()
  publish()
  if (flow && status === 'playing') queueNext()
}

export function toggleVoice(): void {
  if (status === 'playing') pauseVoice()
  else if (status === 'paused') resumeVoice()
}

export function skipVoice(dir: -1 | 1): void {
  if (status === 'idle' || !lines.length) return
  token += 1
  pending = null
  preparing = false
  window.clearTimeout(speakTimer)
  clearFallback()
  clearStall()
  clearFollow()
  stopClip()
  silenceEngine()
  status = 'playing'
  if (dir > 0) {
    void onwards()
    return
  }
  const underway = Date.now() - lineStamp > 1500 || charIndex > 24
  if (!underway && index > 0) index -= 1
  charIndex = 0
  applyLine(lines[index])
  publish()
  speakChunk()
}

export function setVoiceName(name: string): void {
  if (name === voiceName) return
  voiceName = name
  rejectedVoices.clear()
  studioDown = false
  if (error.startsWith('The studio voice')) error = ''
  if (!name || studioId(name)) warmupStudio()
  stopClip()
  savePrefs()
  publish()
  if (status === 'playing' && !pending) speakChunk()
}

export function setSleep(next: SleepChoice): void {
  if (next === sleep) return
  window.clearTimeout(sleepTimer)
  sleep = next
  if (next === 15 || next === 30) {
    sleepTimer = window.setTimeout(() => stopVoice(), next * 60 * 1000)
  }
  if (next === 'end') upcoming = null
  publish()
  if (status === 'playing' && next !== 'end') queueNext()
}

export function speakPlain(text: string): void {
  const key = `plain:${text.length}:${text.slice(0, 48)}`
  void startScript({
    key,
    title: 'Reading',
    lines: [{ key, label: 'Reading', text }],
  })
}

export function speakSnippet(text: string): void {
  const key = `snippet:${text.length}:${text.slice(0, 48)}`
  void startScript({
    key,
    title: 'Reading',
    lines: [{ key, label: 'Reading', text }],
  })
}

export function stopSnippet(): void {
  stopVoice()
}

export function setVoiceRate(next: number): void {
  if (!(VOICE_RATES as readonly number[]).includes(next) || next === rate) return
  rate = next
  stopClip()
  savePrefs()
  publish()
  if (status === 'playing' && !pending) speakChunk()
}

function bindMedia(): void {
  const media = navigator.mediaSession
  if (!media) return
  const bind = (action: MediaSessionAction, run: () => void) => {
    try {
      media.setActionHandler(action, run)
    } catch {
      /* this action is not available */
    }
  }
  bind('play', () => {
    if (status === 'paused') resumeVoice()
  })
  bind('pause', () => pauseVoice())
  bind('stop', () => stopVoice())
  bind('previoustrack', () => skipVoice(-1))
  bind('nexttrack', () => skipVoice(1))
}

onStudioProgress((label) => {
  if (!preparing || status !== 'playing') return
  setNotice(label)
})

if (supported) {
  bindMedia()
  refreshVoices()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    refreshVoices()
    publish()
  })
}
