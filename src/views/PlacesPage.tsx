import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatRef, parseRef } from '../lib/canon'
import { journeyById, readPath, useGuides } from '../lib/guide'
import { loadPlaces, type Place } from '../lib/places'
import { go, type Route } from '../lib/router'
import { useVoice } from '../lib/speech'
import { useAppState } from '../lib/storage'
import { ListenButton, SpokenText, verseScripts } from '../ui'

function pin(on: boolean): L.DivIcon {
  return L.divIcon({
    className: on ? 'pin on' : 'pin',
    iconSize: on ? [18, 18] : [14, 14],
    iconAnchor: on ? [9, 9] : [7, 7],
  })
}

function focusMap(map: L.Map, places: Place[], selectedId: string): void {
  map.invalidateSize()
  const selected = places.find((place) => place.id === selectedId)
  if (selected) {
    map.setView([selected.lat, selected.lng], 9, { animate: false })
    return
  }
  if (!places.length) return
  map.fitBounds(L.latLngBounds(places.map((place) => [place.lat, place.lng])), { padding: [28, 28] })
}

export function PlacesPage({ route }: { route: Extract<Route, { name: 'places' }> | Extract<Route, { name: 'place' }> | Extract<Route, { name: 'journey' }> }) {
  const state = useAppState()
  const guides = useGuides()
  const voice = useVoice()
  const selectedId = route.name === 'place' ? route.id : ''
  const journeyId = route.name === 'journey' ? route.id : ''
  const journey = guides && journeyId ? journeyById(guides, journeyId) : undefined
  const [stopIndex, setStopIndex] = useState<number | null>(null)
  const fittedJourney = useRef('')
  const frame = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    loadPlaces()
      .then((next) => {
        if (live) setPlaces(next)
      })
      .catch(() => {
        if (live) setError('The atlas did not load.')
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const node = frame.current
    if (!node || mapRef.current) return
    const map = L.map(node, { scrollWheelZoom: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 16,
    }).addTo(map)
    map.setView([31.5, 35.2], 6)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    setStopIndex(null)
  }, [journeyId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !places.length) return
    const group = L.layerGroup().addTo(map)
    if (journey) {
      const byId = new Map(places.map((place) => [place.id, place]))
      const resolved = journey.stops.map((stop) => byId.get(stop.place)).filter((place): place is Place => !!place)
      if (resolved.length > 1) {
        const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#c4a46a'
        L.polyline(resolved.map((place) => [place.lat, place.lng] as [number, number]), { color: gold, weight: 3, opacity: 0.9 }).addTo(group)
      }
      resolved.forEach((place, index) => {
        const marker = L.marker([place.lat, place.lng], {
          icon: L.divIcon({
            className: index === stopIndex ? 'route-stop on' : 'route-stop',
            html: String(index + 1),
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
          title: place.name,
          zIndexOffset: 200 + index,
        })
        marker.on('click', () => setStopIndex(index))
        marker.addTo(group)
      })
      const chosen = stopIndex != null ? resolved[stopIndex] : undefined
      if (fittedJourney.current !== journey.id) {
        fittedJourney.current = journey.id
        if (resolved.length === 1) map.setView([resolved[0].lat, resolved[0].lng], 8, { animate: false })
        else if (resolved.length > 1) map.fitBounds(L.latLngBounds(resolved.map((place) => [place.lat, place.lng])), { padding: [28, 28], animate: false })
      } else if (chosen) {
        map.panTo([chosen.lat, chosen.lng], { animate: false })
      }
    } else {
      fittedJourney.current = ''
      for (const place of places) {
        const marker = L.marker([place.lat, place.lng], { icon: pin(place.id === selectedId), title: place.name, zIndexOffset: place.id === selectedId ? 500 : 0 })
        marker.on('click', () => go(`/places/${place.id}`))
        if (place.id === selectedId) {
          marker.bindTooltip(place.name, { permanent: true, direction: 'top', offset: [0, -10], className: 'pin-label' })
        }
        marker.addTo(group)
      }
      focusMap(map, places, selectedId)
    }
    const frameId = window.requestAnimationFrame(() => map.invalidateSize())
    return () => {
      window.cancelAnimationFrame(frameId)
      group.remove()
    }
  }, [places, selectedId, journey, stopIndex])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const row = journeyId ? list.querySelector(`[data-stop="${stopIndex}"]`) : selectedId ? list.querySelector(`[data-place="${selectedId}"]`) : null
    if (!(row instanceof HTMLElement)) return
    const top = list.scrollTop + row.getBoundingClientRect().top - list.getBoundingClientRect().top
    list.scrollTo({ top: Math.max(0, top - 8) })
  }, [places, selectedId, journeyId, stopIndex])

  const stop = journey && stopIndex != null ? journey.stops[stopIndex] : undefined
  const selected = places.find((place) => place.id === (stop ? stop.place : selectedId))

  return (
    <div>
      <p className="kicker">Atlas</p>
      <h1>Places</h1>
      <p className="lede">{journey ? `${journey.who}. ${journey.summary}` : 'Biblical places, marked where the land still holds their names.'}</p>
      {guides && guides.journeys.length ? (
        <div className="chips" aria-label="Journeys">
          {guides.journeys.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === journeyId ? 'chip on' : 'chip'}
              onClick={() => go(item.id === journeyId ? '/places' : `/journey/${item.id}`)}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="miss">{error}</p> : null}
      {journeyId && guides && !journey ? <p className="miss">That journey is not in the atlas.</p> : null}
      {selectedId && places.length && !selected ? <p className="miss">That place is not in the atlas.</p> : null}
      <div className="atlas">
        <div ref={frame} className="map-frame" />
        {journey && !stop ? (
          <article className="panel place-card">
            <p className="kicker">Journey</p>
            <h2>{journey.title}</h2>
            <p>{journey.summary}</p>
            <p className="quiet">A stop stays on the map. Open the verse when you want the text.</p>
          </article>
        ) : selected && stop ? (
          <article className="panel place-card">
            <p className="kicker">Stop {(stopIndex ?? 0) + 1}</p>
            <h2>{selected.name}</h2>
            <p>{stop.note}</p>
            <p className="quiet">{selected.note}</p>
            <button type="button" className="choice gold" onClick={() => go(readPath(stop))}>
              {stop.ref ? formatRef(stop.ref) : 'Read this chapter'}
            </button>
          </article>
        ) : selected ? (
          <article className={voice.lineKey === `place:${selected.id}:note` ? 'panel place-card speaking' : 'panel place-card'}>
            <p className="kicker">Place</p>
            <h2>{selected.name}</h2>
            <p>
              <SpokenText text={selected.note} mark={voice.lineKey === `place:${selected.id}:note` && voice.status !== 'idle' ? voice.charIndex : null} />
            </p>
            <ListenButton
              scriptKey={`place:${selected.id}`}
              title={selected.name}
              label="Read aloud"
              className="choice gold"
              translation={state.translation}
              lines={async () => {
                const note = selected.note.trim()
                  ? [{ key: `place:${selected.id}:note`, label: selected.name, text: selected.note, href: `/places/${selected.id}` }]
                  : []
                const verses = await verseScripts(selected.verses, state.translation)
                return [...note, ...verses]
              }}
            />
            <div className="chips">
              {selected.verses.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  onClick={() => {
                    const parsed = parseRef(id)
                    if (parsed) go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)
                  }}
                >
                  {formatRef(id)}
                </button>
              ))}
            </div>
            <a
              className="choice"
              href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          </article>
        ) : (
          <p className="quiet place-card">Choose a pin, or a name from the list.</p>
        )}
        <div className="atlas-list" aria-label={journey ? 'Stops' : 'Places'} ref={listRef}>
          {journey
            ? journey.stops.map((item, index) => {
                const place = places.find((entry) => entry.id === item.place)
                return (
                  <button
                    key={`${item.place}-${index}`}
                    type="button"
                    data-stop={index}
                    className={index === stopIndex ? 'list-btn on' : 'list-btn'}
                    onClick={() => setStopIndex(index)}
                  >
                    <strong>{index + 1}. {place?.name ?? item.place}</strong>
                    <span className="quiet">{item.note}</span>
                  </button>
                )
              })
            : places.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  data-place={place.id}
                  className={place.id === selectedId ? 'list-btn on' : 'list-btn'}
                  onClick={() => go(`/places/${place.id}`)}
                >
                  <strong>{place.name}</strong>
                  <span className="quiet">{place.note}</span>
                </button>
              ))}
        </div>
      </div>
    </div>
  )
}
