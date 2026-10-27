import { useSyncExternalStore } from 'react'
import { CIRCUIT, formatRef, parseRef, verseId } from './canon'
import { type Translation } from './bible'
import { cardId, newCard, schedule, type MemoryCard } from './srs'
import { RANKS, rankIndex, type RankName } from './school'

export type Theme = 'day' | 'dusk' | 'night'

export const PALETTE_CAP = 16
export const INK_LABEL_CAP = 24

export type InkColor = {
  id: string
  color: string
  label: string
  builtin: boolean
}

export const DEFAULT_PALETTE: readonly InkColor[] = [
  { id: 'gold', color: '#e2b657', label: '', builtin: true },
  { id: 'olive', color: '#8ea85a', label: '', builtin: true },
  { id: 'sky', color: '#7eb0d4', label: '', builtin: true },
  { id: 'rose', color: '#e09aa4', label: '', builtin: true },
  { id: 'violet', color: '#b9a0d6', label: '', builtin: true },
  { id: 'teal', color: '#5eaea0', label: '', builtin: true },
  { id: 'coral', color: '#e08a62', label: '', builtin: true },
  { id: 'slate', color: '#8aa0b4', label: '', builtin: true },
]

const BUILTIN_IDS = new Set(DEFAULT_PALETTE.map((ink) => ink.id))

export function inkHex(value: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null
}

export type Streak = { count: number; lastDay: string }

export type School = {
  letters: string[]
  lessons: string[]
  verses: Record<string, RankName>
}

export type Journal = { see: string; original: string; canon: string; conclude: string }

export const EMPTY_JOURNAL: Journal = { see: '', original: '', canon: '', conclude: '' }

export type Folio = { id: string; title: string; verses: string[] }

export type ProphecyVisit = { seen: string[]; last: string }

const FOLIO_CAP = 40
const FOLIO_VERSE_CAP = 80
const FOLIO_TITLE_CAP = 60

export type State = {
  theme: Theme
  scale: number
  translation: Translation
  book: string
  chapter: number
  verse: number
  read: Record<string, number[]>
  circuit: number
  deck: MemoryCard[]
  notes: Record<string, string>
  marks: string[]
  palette: InkColor[]
  highlights: Record<string, string>
  streak: Streak
  school: School
  journal: Record<string, Journal>
  folios: Folio[]
  prophecy: ProphecyVisit
}

const KEY = 'scripture.v1'

const initial: State = {
  theme: 'day',
  scale: 1,
  translation: 'niv',
  book: 'GEN',
  chapter: 1,
  verse: 1,
  read: {},
  circuit: 0,
  deck: [],
  notes: {},
  marks: [],
  palette: DEFAULT_PALETTE.map((ink) => ({ ...ink })),
  highlights: {},
  streak: { count: 0, lastDay: '' },
  school: { letters: [], lessons: [], verses: {} },
  journal: {},
  folios: [],
  prophecy: { seen: [], last: '' },
}

export const THEME_COLOR: Record<Theme, string> = { day: '#f3efe6', dusk: '#2a241c', night: '#0e100e' }

function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'day'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
}

function asTheme(value: unknown): Theme | null {
  return value === 'day' || value === 'dusk' || value === 'night' ? value : null
}

function asLabel(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, INK_LABEL_CAP)
}

function asPalette(value: unknown): InkColor[] {
  const saved = new Map<string, { color: string; label: string }>()
  const custom: InkColor[] = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const raw = item as { id?: unknown; color?: unknown; label?: unknown }
      if (typeof raw.id !== 'string' || typeof raw.color !== 'string') continue
      const color = inkHex(raw.color)
      if (!color) continue
      const label = asLabel(raw.label)
      if (BUILTIN_IDS.has(raw.id)) {
        saved.set(raw.id, { color, label })
        continue
      }
      if (!/^c[a-z0-9]{4,20}$/.test(raw.id) || custom.some((ink) => ink.id === raw.id)) continue
      custom.push({ id: raw.id, color, label, builtin: false })
    }
  }
  const palette = DEFAULT_PALETTE.map((ink) => {
    const next = saved.get(ink.id)
    return next ? { ...ink, color: next.color, label: next.label } : { ...ink }
  })
  for (const ink of custom) {
    if (palette.length >= PALETTE_CAP) break
    palette.push(ink)
  }
  return palette
}

function asHighlights(value: unknown, palette: InkColor[]): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const ids = new Set(palette.map((ink) => ink.id))
  const highlights: Record<string, string> = {}
  for (const [id, ink] of Object.entries(value as Record<string, unknown>)) {
    if (id.length > 40) continue
    if (typeof ink === 'string' && ids.has(ink)) highlights[id] = ink
  }
  return highlights
}

function newInkId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function asStreak(value: unknown): Streak {
  if (!value || typeof value !== 'object') return { count: 0, lastDay: '' }
  const raw = value as { count?: unknown; lastDay?: unknown }
  const count = typeof raw.count === 'number' && raw.count > 0 ? Math.floor(raw.count) : 0
  const lastDay = typeof raw.lastDay === 'string' ? raw.lastDay : ''
  return { count, lastDay }
}

function asStrings(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length < 80).slice(0, cap)
}

function asSchool(value: unknown): School {
  if (!value || typeof value !== 'object') return { letters: [], lessons: [], verses: {} }
  const raw = value as { letters?: unknown; lessons?: unknown; verses?: unknown }
  const verses: Record<string, RankName> = {}
  if (raw.verses && typeof raw.verses === 'object') {
    for (const [id, rank] of Object.entries(raw.verses as Record<string, unknown>)) {
      if (typeof rank === 'string' && RANKS.some((item) => item.id === rank)) verses[id] = rank as RankName
    }
  }
  return { letters: asStrings(raw.letters, 80), lessons: asStrings(raw.lessons, 80), verses }
}

function folioVerse(value: string): string | null {
  const parsed = parseRef(value)
  if (!parsed) return null
  return verseId(parsed.book, parsed.chapter, parsed.verse)
}

function asFolios(value: unknown): Folio[] {
  if (!Array.isArray(value)) return []
  const folios: Folio[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (folios.length >= FOLIO_CAP) break
    if (!item || typeof item !== 'object') continue
    const raw = item as { id?: unknown; title?: unknown; verses?: unknown }
    if (typeof raw.id !== 'string' || raw.id.length < 1 || raw.id.length > 80 || seen.has(raw.id)) continue
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, FOLIO_TITLE_CAP) : ''
    if (!title) continue
    const verses: string[] = []
    if (Array.isArray(raw.verses)) {
      for (const verse of raw.verses) {
        if (verses.length >= FOLIO_VERSE_CAP) break
        if (typeof verse !== 'string') continue
        const id = folioVerse(verse)
        if (id && !verses.includes(id)) verses.push(id)
      }
    }
    seen.add(raw.id)
    folios.push({ id: raw.id, title, verses })
  }
  return folios
}

function asProphecy(value: unknown): ProphecyVisit {
  if (!value || typeof value !== 'object') return { seen: [], last: '' }
  const raw = value as { seen?: unknown; last?: unknown }
  const seen: string[] = []
  if (Array.isArray(raw.seen)) {
    for (const item of raw.seen) {
      if (seen.length >= 80) break
      if (typeof item !== 'string' || item.length < 1 || item.length > 80) continue
      if (!seen.includes(item)) seen.push(item)
    }
  }
  const last = typeof raw.last === 'string' && raw.last.length > 0 && raw.last.length <= 80 ? raw.last : ''
  return { seen, last }
}

function asJournal(value: unknown): Record<string, Journal> {
  if (!value || typeof value !== 'object') return {}
  const journal: Record<string, Journal> = {}
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Partial<Journal>
    const next = {
      see: typeof raw.see === 'string' ? raw.see.slice(0, 2000) : '',
      original: typeof raw.original === 'string' ? raw.original.slice(0, 2000) : '',
      canon: typeof raw.canon === 'string' ? raw.canon.slice(0, 2000) : '',
      conclude: typeof raw.conclude === 'string' ? raw.conclude.slice(0, 2000) : '',
    }
    if (next.see || next.original || next.canon || next.conclude) journal[id] = next
  }
  return journal
}

export function dayKey(time = Date.now()): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function shiftDay(key: string, delta: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() + delta)
  return dayKey(date.getTime())
}

function advanceStreak(streak: Streak): Streak {
  const today = dayKey()
  if (streak.lastDay === today) return streak
  const count = streak.lastDay === shiftDay(today, -1) ? streak.count + 1 : 1
  return { count, lastDay: today }
}

export function shownStreak(streak: Streak, now = Date.now()): number {
  if (!streak.count || !streak.lastDay) return 0
  const today = dayKey(now)
  if (streak.lastDay === today || streak.lastDay === shiftDay(today, -1)) return streak.count
  return 0
}

function asTranslation(value: unknown): Translation {
  return value === 'kjv' || value === 'web' || value === 'esv' || value === 'niv' ? value : 'kjv'
}

export function memoryLimitNote(translation: Translation): string {
  if (translation === 'niv') return 'Saved NIV text stays within 500 verses on this device.'
  if (translation === 'esv') return 'Saved ESV text stays within 500 verses, the limit Crossway sets for a copy kept on this device.'
  return 'Memory could not take this verse.'
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...initial, theme: systemTheme() }
    const parsed = JSON.parse(raw) as Partial<State>
    const palette = asPalette(parsed.palette)
    return {
      ...initial,
      ...parsed,
      theme: asTheme(parsed.theme) ?? systemTheme(),
      translation: asTranslation(parsed.translation),
      palette,
      highlights: asHighlights(parsed.highlights, palette),
      streak: asStreak(parsed.streak),
      school: asSchool(parsed.school),
      journal: asJournal(parsed.journal),
      folios: asFolios(parsed.folios),
      prophecy: asProphecy(parsed.prophecy),
    }
  } catch {
    return initial
  }
}

let state: State = typeof localStorage === 'undefined' ? initial : load()
const listeners = new Set<() => void>()

function emit(): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  document.documentElement.dataset.theme = state.theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[state.theme])
  listeners.forEach((listener) => listener())
}

function patch(next: Partial<State>): void {
  state = { ...state, ...next }
  emit()
}

export function getState(): State {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAppState(): State {
  return useSyncExternalStore(subscribe, getState, getState)
}

export function setTheme(theme: Theme): void {
  patch({ theme })
}

export function setScale(scale: number): void {
  patch({ scale: Math.min(1.45, Math.max(0.9, scale)) })
}

export function setTranslation(translation: Translation): void {
  patch({ translation })
}

export function markProphecy(id: string): void {
  if (!id || id.length > 80) return
  const seen = state.prophecy.seen.includes(id) ? state.prophecy.seen : [...state.prophecy.seen, id].slice(-80)
  if (state.prophecy.last === id && seen === state.prophecy.seen) return
  patch({ prophecy: { seen, last: id } })
}

export function setPosition(book: string, chapter: number, verse = 1): void {
  patch({ book, chapter, verse })
}

export function isChapterRead(book: string, chapter: number): boolean {
  return (state.read[book] ?? []).includes(chapter)
}

export function markChapterRead(book: string, chapter: number): void {
  const already = (state.read[book] ?? []).includes(chapter)
  const have = new Set(state.read[book] ?? [])
  have.add(chapter)
  const read = { ...state.read, [book]: [...have].sort((a, b) => a - b) }
  let circuit = state.circuit
  const current = CIRCUIT[circuit]
  if (!already && current && current.book === book && current.chapter === chapter && circuit < CIRCUIT.length) {
    circuit += 1
  }
  patch({ read, circuit })
}

export function continueCircuit(): void {
  if (state.circuit < CIRCUIT.length) patch({ circuit: state.circuit + 1 })
}

export function resetCircuit(): void {
  patch({ circuit: 0 })
}

export function meetLetter(id: string): void {
  if (state.school.letters.includes(id)) return
  patch({ school: { ...state.school, letters: [...state.school.letters, id] } })
}

export function meetLesson(id: string): void {
  if (state.school.lessons.includes(id)) return
  patch({ school: { ...state.school, lessons: [...state.school.lessons, id] } })
}

export function learnVerse(id: string, rank: RankName): void {
  const have = state.school.verses[id]
  if (rankIndex(have) >= rankIndex(rank)) return
  patch({ school: { ...state.school, verses: { ...state.school.verses, [id]: rank } } })
}

export function createFolio(title: string): string | null {
  const name = title.trim().slice(0, FOLIO_TITLE_CAP)
  if (!name || state.folios.length >= FOLIO_CAP) return null
  const id = `folio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  patch({ folios: [...state.folios, { id, title: name, verses: [] }] })
  return id
}

export function renameFolio(folioId: string, title: string): void {
  const name = title.trim().slice(0, FOLIO_TITLE_CAP)
  if (!name) return
  patch({
    folios: state.folios.map((folio) => (folio.id === folioId ? { ...folio, title: name } : folio)),
  })
}

export function deleteFolio(folioId: string): void {
  patch({ folios: state.folios.filter((folio) => folio.id !== folioId) })
}

export function addVerseToFolio(folioId: string, verse: string): boolean {
  const id = folioVerse(verse)
  if (!id) return false
  const index = state.folios.findIndex((folio) => folio.id === folioId)
  if (index < 0) return false
  const folio = state.folios[index]
  if (folio.verses.includes(id)) return true
  if (folio.verses.length >= FOLIO_VERSE_CAP) return false
  const folios = state.folios.slice()
  folios[index] = { ...folio, verses: [...folio.verses, id] }
  patch({ folios })
  return true
}

export function removeVerseFromFolio(folioId: string, verse: string): void {
  patch({
    folios: state.folios.map((folio) => (
      folio.id === folioId ? { ...folio, verses: folio.verses.filter((item) => item !== verse) } : folio
    )),
  })
}

export function setJournal(id: string, field: keyof Journal, value: string): void {
  const current = state.journal[id] ?? { ...EMPTY_JOURNAL }
  const next = { ...current, [field]: value.slice(0, 2000) }
  const journal = { ...state.journal }
  if (!next.see && !next.original && !next.canon && !next.conclude) delete journal[id]
  else journal[id] = next
  patch({ journal })
}

export function setNote(id: string, note: string): void {
  const notes = { ...state.notes }
  const trimmed = note.slice(0, 2000)
  if (trimmed.trim()) notes[id] = trimmed
  else delete notes[id]
  patch({ notes })
}

export function toggleMark(id: string): void {
  const marks = state.marks.includes(id) ? state.marks.filter((item) => item !== id) : [...state.marks, id]
  patch({ marks })
}

export function toggleMarks(ids: string[]): void {
  if (!ids.length) return
  const clear = ids.every((id) => state.marks.includes(id))
  const marks = new Set(state.marks)
  for (const id of ids) {
    if (clear) marks.delete(id)
    else marks.add(id)
  }
  patch({ marks: [...marks] })
}

export function setHighlight(ids: string[], ink: string): void {
  if (!ids.length || !state.palette.some((item) => item.id === ink)) return
  const highlights = { ...state.highlights }
  const clear = ids.every((id) => highlights[id] === ink)
  for (const id of ids) {
    if (clear) delete highlights[id]
    else highlights[id] = ink
  }
  patch({ highlights })
}

export function addInk(color: string, label: string): boolean {
  const hex = inkHex(color)
  if (!hex || state.palette.length >= PALETTE_CAP) return false
  const id = newInkId()
  patch({
    palette: [...state.palette, { id, color: hex, label: asLabel(label), builtin: false }],
  })
  return true
}

export function updateInk(id: string, next: { color?: string; label?: string }): void {
  if (!state.palette.some((item) => item.id === id)) return
  const palette = state.palette.map((item) => {
    if (item.id !== id) return item
    const color = next.color === undefined ? item.color : (inkHex(next.color) ?? item.color)
    const label = next.label === undefined ? item.label : asLabel(next.label)
    return { ...item, color, label }
  })
  patch({ palette })
}

export function removeInk(id: string): void {
  const ink = state.palette.find((item) => item.id === id)
  if (!ink || ink.builtin) return
  const highlights = { ...state.highlights }
  for (const [verse, inkId] of Object.entries(highlights)) {
    if (inkId === id) delete highlights[verse]
  }
  patch({
    palette: state.palette.filter((item) => item.id !== id),
    highlights,
  })
}

export function addMemory(translation: Translation, verses: string[], text: string): boolean {
  const id = cardId(translation, verses)
  if (state.deck.some((card) => card.id === id)) return true
  if (translation === 'esv' || translation === 'niv') {
    const kept = state.deck.filter((card) => card.translation === translation).reduce((sum, card) => sum + card.verses.length, 0)
    if (kept + verses.length > 500) return false
  }
  const first = verses[0]
  const last = verses[verses.length - 1]
  const label = verses.length === 1 ? formatRef(first) : `${formatRef(first)} – ${formatRef(last)}`
  patch({ deck: [...state.deck, newCard({ translation, verses, label, text })] })
  return true
}

export function reviewMemory(id: string, grade: number, accuracy: number): void {
  patch({
    deck: state.deck.map((card) => (card.id === id ? schedule(card, grade, accuracy) : card)),
    streak: grade >= 3 ? advanceStreak(state.streak) : state.streak,
  })
}

export function releaseMemory(id: string): void {
  if (!state.deck.some((card) => card.id === id)) return
  patch({ deck: state.deck.filter((card) => card.id !== id) })
}

export function passageIds(book: string, chapter: number, start: number, end: number): string[] {
  const ids: string[] = []
  const last = Math.max(start, end)
  for (let verse = start; verse <= last; verse += 1) ids.push(verseId(book, chapter, verse))
  return ids
}
