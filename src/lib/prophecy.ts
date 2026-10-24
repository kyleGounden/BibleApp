import type { ProphecyFile } from './catalog'

export type ProphecySpan = {
  id: string
  nav: string
  title: string
  line: string
  kind: 'fulfilled' | 'ahead'
}

export const PROPHECY_SPANS: readonly ProphecySpan[] = [
  {
    id: 'promise',
    nav: 'Promise',
    title: 'The promise',
    line: 'A seed is named, and a prophet from the midst of the people.',
    kind: 'fulfilled',
  },
  {
    id: 'exile',
    nav: 'Exile',
    title: 'Kings and exile',
    line: 'Words spoken in the land come due among the kings, and in the seventy years.',
    kind: 'fulfilled',
  },
  {
    id: 'birth',
    nav: 'Birth',
    title: 'His birth',
    line: 'A virgin, Bethlehem, Egypt, and Rachel weeping.',
    kind: 'fulfilled',
  },
  {
    id: 'appearing',
    nav: 'Appearing',
    title: 'His appearing',
    line: 'A voice in the wilderness, light in Galilee, the Spirit upon him.',
    kind: 'fulfilled',
  },
  {
    id: 'ministry',
    nav: 'Ministry',
    title: 'His ministry',
    line: 'He bears infirmities, opens a parable, and they are taught of God.',
    kind: 'fulfilled',
  },
  {
    id: 'passion',
    nav: 'Passion',
    title: 'His passion',
    line: 'The king comes, the garments are parted, and the cry is heard.',
    kind: 'fulfilled',
  },
  {
    id: 'risen',
    nav: 'Risen',
    title: 'Risen and sent',
    line: 'The psalm of resurrection, Pentecost, the stone, and a light to the nations.',
    kind: 'fulfilled',
  },
  {
    id: 'ahead',
    nav: 'Ahead',
    title: 'Still ahead',
    line: 'The words themselves are still set before the reader.',
    kind: 'ahead',
  },
]

export type WalkItem = {
  kind: 'fulfilled' | 'ahead'
  id: string
  title: string
  section: string
}

export function spanOf(id: string | undefined): ProphecySpan | null {
  if (!id) return null
  return PROPHECY_SPANS.find((span) => span.id === id) ?? null
}

export function walk(data: ProphecyFile): WalkItem[] {
  const items: WalkItem[] = []
  for (const span of PROPHECY_SPANS) {
    if (span.kind === 'fulfilled') {
      for (const thread of data.fulfilled) {
        if (thread.section === span.id) items.push({ kind: 'fulfilled', id: thread.id, title: thread.title, section: span.id })
      }
    } else {
      for (const thread of data.ahead) {
        if (thread.section === span.id) items.push({ kind: 'ahead', id: thread.id, title: thread.title, section: span.id })
      }
    }
  }
  return items
}

export function nextWalk(data: ProphecyFile, id: string): WalkItem | null {
  const items = walk(data)
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return null
  return items[index + 1] ?? null
}

export function dayOfYear(now = Date.now()): number {
  const date = new Date(now)
  const start = new Date(date.getFullYear(), 0, 1)
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((midnight.getTime() - start.getTime()) / 86400000) + 1
}

export function todayThread(data: ProphecyFile, now = Date.now()): WalkItem | null {
  const items = walk(data)
  if (!items.length) return null
  const index = (dayOfYear(now) - 1) % items.length
  return items[index] ?? null
}
