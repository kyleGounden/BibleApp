import { useEffect, useState } from 'react'
import { parseRef } from './canon'

export type WriterHow = 'named' | 'traditional' | 'unnamed' | 'gathered'

export type Person = {
  id: string
  name: string
  also?: string
  about: string
  origin?: string
  verses: string[]
}

export type OutlineBeat = { label: string; from: number; to: number }

export type BookGuide = {
  id: string
  line: string
  writer: { person?: string; how: WriterHow; verse?: string; note: string }
  audience: { who: string; where?: string; when: string; situation: string }
  writtenFrom?: string
  fromNote?: string
  when: string
  purpose: string
  outline: OutlineBeat[]
  mapPlaces?: string[]
}

export type StopAt = { book: string; chapters: number[] }

export type Stop = {
  place: string
  at: StopAt[]
  ref?: string
  note: string
}

export type Journey = {
  id: string
  title: string
  who: string
  person?: string
  summary: string
  stops: Stop[]
  chapterNotes: Record<string, string>
}

export type Guides = {
  people: Person[]
  books: BookGuide[]
  journeys: Journey[]
}

export type ChainStop = { stop: Stop; on: boolean }

export type JourneyHere = {
  journey: Journey
  chain: ChainStop[]
  sentence: string
}

const EMPTY: Guides = { people: [], books: [], journeys: [] }

let cache: Promise<Guides> | null = null

export function loadGuides(): Promise<Guides> {
  if (!cache) {
    cache = fetch('/data/guides.json')
      .then((response) => {
        if (!response.ok) throw new Error('Missing guides')
        return response.json() as Promise<Guides>
      })
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}

export function useGuides(): Guides | null {
  const [guides, setGuides] = useState<Guides | null>(null)
  useEffect(() => {
    let live = true
    loadGuides()
      .then((next) => {
        if (live) setGuides(next)
      })
      .catch(() => {
        if (live) setGuides(EMPTY)
      })
    return () => {
      live = false
    }
  }, [])
  return guides
}

export function howLabel(how: WriterHow): string {
  if (how === 'named') return 'Named in the book'
  if (how === 'traditional') return 'Received by the church'
  if (how === 'gathered') return 'Named among the writers'
  return 'The book names no writer'
}

export function personById(guides: Guides, id: string | undefined): Person | undefined {
  if (!id) return undefined
  return guides.people.find((person) => person.id === id)
}

export function bookGuide(guides: Guides, id: string): BookGuide | undefined {
  return guides.books.find((book) => book.id === id)
}

export function writerName(guides: Guides, guide: BookGuide): string {
  return personById(guides, guide.writer.person)?.name ?? 'Not named'
}

export function booksForPerson(guides: Guides, id: string): BookGuide[] {
  return guides.books.filter((book) => book.writer.person === id)
}

export function journeysForPerson(guides: Guides, id: string): Journey[] {
  return guides.journeys.filter((journey) => journey.person === id)
}

export function journeysForBook(guides: Guides, book: string): Journey[] {
  return guides.journeys.filter((journey) => journey.stops.some((stop) => stop.at.some((at) => at.book === book)))
}

export function journeyById(guides: Guides, id: string): Journey | undefined {
  return guides.journeys.find((journey) => journey.id === id)
}

export function settingFor(guides: Guides, book: string, chapter: number): { guide?: BookGuide; journeys: JourneyHere[] } {
  const guide = bookGuide(guides, book)
  const journeys: JourneyHere[] = []
  for (const journey of guides.journeys) {
    const indexes: number[] = []
    journey.stops.forEach((stop, index) => {
      if (stop.at.some((at) => at.book === book && at.chapters.includes(chapter))) indexes.push(index)
    })
    if (!indexes.length) continue
    const lo = Math.max(0, Math.min(...indexes) - 1)
    const hi = Math.min(journey.stops.length - 1, Math.max(...indexes) + 1)
    const chain = journey.stops.slice(lo, hi + 1).map((stop, offset) => ({
      stop,
      on: indexes.includes(lo + offset),
    }))
    const sentence = journey.chapterNotes[`${book}.${chapter}`] ?? journey.stops[indexes[indexes.length - 1]].note
    journeys.push({ journey, chain, sentence })
  }
  return { guide, journeys }
}

export function stopTarget(stop: Stop, prefer?: string): { book: string; chapter: number; verse?: number } {
  const parsed = stop.ref ? parseRef(stop.ref) : null
  if (parsed && (!prefer || parsed.book === prefer)) {
    return { book: parsed.book, chapter: parsed.chapter, verse: parsed.verse }
  }
  const at = (prefer && stop.at.find((item) => item.book === prefer)) || stop.at[0]
  return { book: at.book, chapter: at.chapters[0] }
}

export function readPath(stop: Stop, prefer?: string): string {
  const target = stopTarget(stop, prefer)
  return target.verse
    ? `/read/${target.book}/${target.chapter}/${target.verse}`
    : `/read/${target.book}/${target.chapter}`
}
