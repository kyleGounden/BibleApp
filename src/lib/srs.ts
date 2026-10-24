import type { Translation } from './bible'

export type MemoryCard = {
  id: string
  translation: Translation
  verses: string[]
  label: string
  text: string
  ef: number
  interval: number
  reps: number
  lapses: number
  due: number
  accuracy: number | null
}

export function cardId(translation: Translation, verses: string[]): string {
  return `${translation}:${verses.join('+')}`
}

export function newCard(input: {
  translation: Translation
  verses: string[]
  label: string
  text: string
}): MemoryCard {
  return {
    id: cardId(input.translation, input.verses),
    translation: input.translation,
    verses: input.verses,
    label: input.label,
    text: input.text,
    ef: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: Date.now(),
    accuracy: null,
  }
}

export function schedule(card: MemoryCard, grade: number, accuracy: number): MemoryCard {
  let ef = card.ef
  let interval = card.interval
  let reps = card.reps
  let lapses = card.lapses
  let due: number
  if (grade < 3) {
    reps = 0
    interval = 0
    lapses += 1
    due = Date.now()
  } else {
    if (reps === 0) interval = 1
    else if (reps === 1) interval = 6
    else interval = Math.max(1, Math.round(interval * ef))
    reps += 1
    due = Date.now() + interval * 86400000
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)))
  return { ...card, ef, interval, reps, lapses, due, accuracy }
}

export function gradeFromAccuracy(accuracy: number): number {
  if (accuracy >= 0.97) return 5
  if (accuracy >= 0.9) return 4
  if (accuracy >= 0.75) return 3
  if (accuracy >= 0.5) return 2
  return 1
}

export function recitationAccuracy(expected: string, typed: string): number {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
  const target = norm(expected)
  const given = norm(typed)
  if (!target.length) return 0
  let hit = 0
  for (const word of given) {
    if (word === target[hit]) hit += 1
    if (hit >= target.length) break
  }
  return hit / target.length
}

export function dueCards(deck: MemoryCard[], now = Date.now()): MemoryCard[] {
  return deck.filter((card) => card.due <= now).sort((a, b) => a.due - b.due)
}

export function isLearning(card: MemoryCard): boolean {
  return card.reps === 0 && card.accuracy == null
}

/** How firmly a verse is kept, from a first reading to a long interval. */
export function memoryStrength(card: MemoryCard): number {
  if (isLearning(card)) return 0
  const accuracy = card.accuracy ?? 0
  const reps = 1 - Math.exp(-card.reps / 4)
  const interval = 1 - Math.exp(-card.interval / 21)
  const ease = Math.min(1, Math.max(0, (card.ef - 1.3) / 1.7))
  const lapses = 1 / (1 + card.lapses * 0.15)
  const raw = (accuracy * 0.34 + reps * 0.36 + interval * 0.22 + ease * 0.08) * lapses
  return Math.max(0, Math.min(1, raw))
}

export function strengthLabel(value: number): string {
  if (value <= 0.02) return 'New'
  if (value < 0.34) return 'Learning'
  if (value < 0.62) return 'Held'
  if (value < 0.85) return 'Sure'
  return 'Sealed'
}

export type VersePiece = { kind: 'word'; text: string; index: number } | { kind: 'gap'; text: string }

const WORD = /[A-Za-z0-9]+(?:['’‘-][A-Za-z0-9]+)*|[^A-Za-z0-9]+/g

export function versePieces(text: string): VersePiece[] {
  const pieces: VersePiece[] = []
  let index = 0
  for (const match of text.matchAll(WORD)) {
    const part = match[0]
    if (!part) continue
    if (/[A-Za-z0-9]/.test(part)) {
      pieces.push({ kind: 'word', text: part, index })
      index += 1
    } else {
      pieces.push({ kind: 'gap', text: part })
    }
  }
  return pieces
}

const CLAUSE = /[,;:.?!]/

export type PhraseRun = {
  phrase: number
  nodes: VersePiece[]
}

/** Group a verse into clauses split on comma, semicolon, colon, or sentence end. */
export function phraseRuns(pieces: VersePiece[]): PhraseRun[] {
  const runs: PhraseRun[] = []
  let nodes: VersePiece[] = []
  let phrase = 0
  let words = 0
  const close = () => {
    if (!nodes.length) return
    runs.push({ phrase: words ? phrase : -1, nodes })
    if (words) phrase += 1
    nodes = []
    words = 0
  }
  for (const piece of pieces) {
    if (piece.kind === 'word') {
      words += 1
      nodes.push(piece)
      continue
    }
    nodes.push(piece)
    if (words && CLAUSE.test(piece.text)) close()
  }
  close()
  return runs
}

export function phraseWordIndexes(run: PhraseRun): number[] {
  return run.nodes.flatMap((piece) => (piece.kind === 'word' ? [piece.index] : []))
}

export function wordIndexAt(text: string, charIndex: number): number {
  let cursor = 0
  let word = -1
  for (const piece of versePieces(text)) {
    const end = cursor + piece.text.length
    if (piece.kind === 'word') {
      word = piece.index
      if (charIndex < end) return piece.index
    }
    cursor = end
  }
  return word
}

function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/'/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function sameWord(expected: string, given: string): boolean {
  const target = normalizeWord(expected)
  const typed = normalizeWord(given)
  return target.length > 0 && target === typed
}

export function wordPrefix(expected: string, given: string): boolean {
  const target = normalizeWord(expected)
  const typed = normalizeWord(given)
  return typed.length > 0 && target.startsWith(typed)
}
