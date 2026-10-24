import { useEffect, useState } from 'react'
import { loadTrails, type Trail } from '../lib/catalog'
import { go, type Route } from '../lib/router'
import { useAppState } from '../lib/storage'
import { ListenButton, VerseQuote, verseScripts } from '../ui'

export function TrailPage({ route }: { route: Extract<Route, { name: 'trail' }> }) {
  const state = useAppState()
  const [trail, setTrail] = useState<Trail | null>(null)
  useEffect(() => {
    let live = true
    loadTrails().then((trails) => {
      if (live) setTrail(trails.find((item) => item.id === route.id) ?? null)
    })
    return () => {
      live = false
    }
  }, [route.id])
  if (!trail) return <p className="quiet">Opening the trail…</p>
  return (
    <div>
      <button type="button" className="text-btn" onClick={() => go('/canon')}>Canon</button>
      <p className="kicker">Trail</p>
      <h1>{trail.title}</h1>
      <ListenButton
        scriptKey={`trail:${trail.id}:${state.translation}`}
        title={trail.title}
        label="Read all"
        className="choice"
        translation={state.translation}
        lines={() => verseScripts(trail.verses, state.translation)}
      />
      {trail.verses.map((id) => (
        <VerseQuote key={id} id={id} translation={state.translation} />
      ))}
    </div>
  )
}
