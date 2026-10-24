import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Place } from '../lib/places'

export function AtlasMap({
  places,
  pins,
  line = false,
  onPick,
}: {
  places: Place[]
  pins: string[]
  line?: boolean
  onPick?: (id: string, index: number) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const pinKey = pins.join('|')

  useEffect(() => {
    const node = frame.current
    if (!node || mapRef.current) return
    const map = L.map(node, { scrollWheelZoom: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 16,
    }).addTo(map)
    map.setView([31.5, 35.2], 5)
    mapRef.current = map
    const frameId = window.requestAnimationFrame(() => map.invalidateSize())
    return () => {
      window.cancelAnimationFrame(frameId)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const byId = new Map(places.map((place) => [place.id, place]))
    const resolved = pinKey.split('|').filter(Boolean).map((id) => byId.get(id)).filter((place): place is Place => !!place)
    const group = L.layerGroup().addTo(map)
    if (line && resolved.length > 1) {
      const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#c4a46a'
      L.polyline(
        resolved.map((place) => [place.lat, place.lng] as [number, number]),
        { color: gold, weight: 3, opacity: 0.9 },
      ).addTo(group)
    }
    resolved.forEach((place, index) => {
      const marker = L.marker([place.lat, place.lng], {
        icon: L.divIcon({
          className: line ? 'route-stop' : 'pin',
          html: line ? String(index + 1) : '',
          iconSize: line ? [26, 26] : [14, 14],
          iconAnchor: line ? [13, 13] : [7, 7],
        }),
        title: place.name,
        zIndexOffset: 100 + index,
      })
      marker.on('click', () => onPickRef.current?.(place.id, index))
      marker.addTo(group)
    })
    if (resolved.length === 1) map.setView([resolved[0].lat, resolved[0].lng], 8, { animate: false })
    else if (resolved.length > 1) {
      map.fitBounds(L.latLngBounds(resolved.map((place) => [place.lat, place.lng])), { padding: [28, 28], animate: false })
    }
    const frameId = window.requestAnimationFrame(() => map.invalidateSize())
    return () => {
      window.cancelAnimationFrame(frameId)
      group.remove()
    }
  }, [places, pinKey, line])

  return <div ref={frame} className="map-frame guide-map" />
}
