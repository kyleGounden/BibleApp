import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatRef, parseRef } from '../lib/canon'
import { journeyById, readPath, useGuides } from '../lib/guide'
import { loadPlaces, type Place } from '../lib/places'
import { go, type Route } from '../lib/router'
import { startScript, stopVoice, useVoice } from '../lib/speech'
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
  const [walking, setWalking] = useState(false)
  const fittedJourney = useRef('')
  const frame = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [error, setError] = useState('')
  const walkToken = useRef(0)
  const armedKey = useRef('')
  const walkPhase = useRef<'idle' | 'starting' | 'speaking'>('idle')

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
    setWalking(false)
    walkToken.current += 1
    walkPhase.current = 'idle'
    armedKey.current = ''
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
        marker.on('click', () => {
          if (walking) return
          setStopIndex(index)
        })
        marker.addTo(group)
      })
      const chosen = stopIndex != null ? resolved[stopIndex] : undefined
      if (fittedJourney.current !== journey.id) {
        fittedJourney.current = journey.id
        if (resolved.length === 1) map.setView([resolved[0].lat, resolved[0].lng], 8, { animate: false })
        else if (resolved.length > 1) map.fitBounds(L.latLngBounds(resolved.map((place) => [place.lat, place.lng])), { padding: [28, 28], animate: false })
      } else if (chosen) {
        map.flyTo([chosen.lat, chosen.lng], Math.max(map.getZoom(), walking ? 8 : 7), { animate: true, duration: walking ? 1.1 : 0.55 })
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
  }, [places, selectedId, journey, stopIndex, walking])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const row = journeyId ? list.querySelector(`[data-stop="${stopIndex}"]`) : selectedId ? list.querySelector(`[data-place="${selectedId}"]`) : null
    if (!(row instanceof HTMLElement)) return
    const top = list.scrollTop + row.getBoundingClientRect().top - list.getBoundingClientRect().top
    list.scrollTo({ top: Math.max(0, top - 8), behavior: walking ? 'smooth' : 'auto' })
  }, [places, selectedId, journeyId, stopIndex, walking])

  useEffect(() => {
    if (!walking || !journey || stopIndex == null) return
    const stop = journey.stops[stopIndex]
    if (!stop) {
      setWalking(false)
      return
    }
    const token = ++walkToken.current
    const key = `journey-walk:${journey.id}:${stopIndex}`
    armedKey.current = key
    walkPhase.current = 'starting'
    const place = places.find((entry) => entry.id === stop.place)
    let cancelled = false

    void (async () => {
      const note = stop.note.trim()
        ? [{ key: `${key}:note`, label: place?.name ?? stop.place, text: stop.note, href: readPath(stop) }]
        : []
      const verses = stop.ref ? await verseScripts([stop.ref], state.translation) : []
      if (cancelled || token !== walkToken.current) return
      const lines = [...note, ...verses]
      if (!lines.length) {
        window.setTimeout(() => {
          if (cancelled || token !== walkToken.current) return
          walkPhase.current = 'idle'
          armedKey.current = ''
          if (stopIndex >= journey.stops.length - 1) setWalking(false)
          else setStopIndex(stopIndex + 1)
        }, 900)
        return
      }
      await startScript({
        key,
        title: `${journey.title} · ${stopIndex + 1}`,
        lines,
        translation: state.translation,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [walking, journey, stopIndex, places, state.translation])

  useEffect(() => {
    if (!walking) return
    if ((voice.status === 'playing' || voice.status === 'paused') && voice.scriptKey === armedKey.current) {
      walkPhase.current = 'speaking'
      return
    }
    if (walkPhase.current !== 'speaking' || voice.status !== 'idle') return
    walkPhase.current = 'idle'
    armedKey.current = ''
    if (!journey || stopIndex == null) {
      setWalking(false)
      return
    }
    if (stopIndex >= journey.stops.length - 1) {
      setWalking(false)
      return
    }
    setStopIndex(stopIndex + 1)
  }, [voice.status, voice.scriptKey, walking, journey, stopIndex])

  useEffect(() => () => {
    walkToken.current += 1
    if (armedKey.current.startsWith('journey-walk:')) stopVoice()
  }, [])

  const stop = journey && stopIndex != null ? journey.stops[stopIndex] : undefined
  const selected = places.find((place) => place.id === (stop ? stop.place : selectedId))

  function beginWalk() {
    if (!journey?.stops.length) return
    setWalking(true)
    setStopIndex(0)
  }

  function endWalk() {
    walkToken.current += 1
    walkPhase.current = 'idle'
    armedKey.current = ''
    setWalking(false)
    stopVoice()
  }

  function skipStop(dir: -1 | 1) {
    if (!journey || stopIndex == null) return
    const next = stopIndex + dir
    if (next < 0 || next >= journey.stops.length) return
    walkToken.current += 1
    walkPhase.current = 'idle'
    armedKey.current = ''
    stopVoice()
    setStopIndex(next)
  }

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
              onClick={() => {
                endWalk()
                go(item.id === journeyId ? '/places' : `/journey/${item.id}`)
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : null}
      {journey ? (
        <div className="journey-walk" role="group" aria-label="Walk this journey">
          {walking ? (
            <>
              <button type="button" className="choice gold" onClick={endWalk}>Stop walk</button>
              <button type="button" className="choice" onClick={() => skipStop(-1)} disabled={stopIndex == null || stopIndex <= 0}>Previous stop</button>
              <button type="button" className="choice" onClick={() => skipStop(1)} disabled={stopIndex == null || stopIndex >= journey.stops.length - 1}>Next stop</button>
            </>
          ) : (
            <button type="button" className="choice gold" onClick={beginWalk}>Walk this journey</button>
          )}
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
            <p className="quiet">Walk the road stop by stop, or tap a pin when you want one place.</p>
          </article>
        ) : selected && stop ? (
          <article className={walking ? 'panel place-card is-walk' : 'panel place-card'}>
            <p className="kicker">{walking ? 'Walking' : 'Stop'} {(stopIndex ?? 0) + 1} of {journey?.stops.length ?? 0}</p>
            <h2>{selected.name}</h2>
            <p>{stop.note}</p>
            <p className="quiet">{selected.note}</p>
            <button type="button" className="choice gold" onClick={() => go(readPath(stop))}>
              {stop.ref ? formatRef(stop.ref) : 'Read this chapter'}
            </button>
            {!walking ? (
              <ListenButton
                scriptKey={`journey-stop:${journeyId}:${stopIndex}`}
                title={selected.name}
                label="Read this stop"
                className="choice"
                translation={state.translation}
                lines={async () => {
                  const note = stop.note.trim()
                    ? [{ key: `journey-stop:${journeyId}:${stopIndex}:note`, label: selected.name, text: stop.note, href: readPath(stop) }]
                    : []
                  const verses = stop.ref ? await verseScripts([stop.ref], state.translation) : []
                  return [...note, ...verses]
                }}
              />
            ) : null}
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
                    onClick={() => {
                      if (walking) {
                        walkToken.current += 1
                        walkPhase.current = 'idle'
                        armedKey.current = ''
                        stopVoice()
                      }
                      setStopIndex(index)
                    }}
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
