import { useEffect, useState } from 'react'

export type Place = {
  id: string
  name: string
  aliases: string[]
  lat: number
  lng: number
  note: string
  verses: string[]
}

let cache: Promise<Place[]> | null = null

export function loadPlaces(): Promise<Place[]> {
  if (!cache) {
    cache = fetch('/data/places.json')
      .then((response) => {
        if (!response.ok) throw new Error('Missing places')
        return response.json() as Promise<Place[]>
      })
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}

function letters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

export function matchPlace(places: Place[], word: string): Place | undefined {
  const wanted = letters(word)
  if (wanted.length < 2) return undefined
  return places.find((place) => [place.name, ...place.aliases].some((alias) => letters(alias) === wanted))
}

const SHORT_NAMES = new Set(['ai', 'ur'])

function phrase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function placesInText(places: Place[], text: string): Place[] {
  const hay = ` ${phrase(text)} `
  const found: Place[] = []
  for (const place of places) {
    const names = [place.name, ...place.aliases]
    const hit = names.some((name) => {
      const needle = phrase(name)
      if (!needle) return false
      if (needle.length < 3 && !SHORT_NAMES.has(needle)) return false
      return hay.includes(` ${needle} `)
    })
    if (hit) found.push(place)
  }
  return found.sort((a, b) => a.name.localeCompare(b.name))
}

export function placeById(places: Place[], id: string | undefined): Place | undefined {
  if (!id) return undefined
  return places.find((place) => place.id === id)
}

export function usePlaces(): Place[] {
  const [places, setPlaces] = useState<Place[]>([])
  useEffect(() => {
    let live = true
    loadPlaces()
      .then((next) => {
        if (live) setPlaces(next)
      })
      .catch(() => {
        if (live) setPlaces([])
      })
    return () => {
      live = false
    }
  }, [])
  return places
}
