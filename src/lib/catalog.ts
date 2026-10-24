import { expandRef } from './canon'

export type Step = { cited: string; citing: string }
export type FulfilledThread = { id: string; title: string; section: string; steps: Step[] }
export type AheadThread = { id: string; title: string; section: string; verses: string[] }
export type ProphecyFile = { fulfilled: FulfilledThread[]; ahead: AheadThread[] }
export type Trail = { id: string; title: string; verses: string[] }
export type ThreadHit = { kind: 'fulfilled' | 'ahead'; id: string; title: string }

let prophecyPromise: Promise<ProphecyFile> | null = null
let trailsPromise: Promise<Trail[]> | null = null

export function loadProphecy(): Promise<ProphecyFile> {
  if (!prophecyPromise) {
    prophecyPromise = fetch('/data/prophecy.json').then((response) => {
      if (!response.ok) throw new Error('prophecy')
      return response.json() as Promise<ProphecyFile>
    })
  }
  return prophecyPromise
}

export function loadTrails(): Promise<Trail[]> {
  if (!trailsPromise) {
    trailsPromise = fetch('/data/trails.json').then((response) => {
      if (!response.ok) throw new Error('trails')
      return response.json() as Promise<Trail[]>
    })
  }
  return trailsPromise
}

export async function threadsForVerse(id: string): Promise<ThreadHit[]> {
  const data = await loadProphecy()
  const hits: ThreadHit[] = []
  for (const thread of data.fulfilled) {
    const verses = thread.steps.flatMap((step) => [...expandRef(step.cited), ...expandRef(step.citing)])
    if (verses.includes(id)) hits.push({ kind: 'fulfilled', id: thread.id, title: thread.title })
  }
  for (const thread of data.ahead) {
    const verses = thread.verses.flatMap((verse) => expandRef(verse))
    if (verses.includes(id)) hits.push({ kind: 'ahead', id: thread.id, title: thread.title })
  }
  return hits
}
