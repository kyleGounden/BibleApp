import { useEffect, useMemo, useState } from 'react'
import { bookById, formatRef, parseRef, shortRef } from '../lib/canon'
import { loadXrefs, type XRefGroup } from '../lib/bible'
import { go, type Route } from '../lib/router'
import { useAppState } from '../lib/storage'
import { ListenButton, VerseQuote, verseScripts } from '../ui'

const TRAIL_KEY = 'scripture.trail'
type Filter = 'all' | 'ot' | 'nt' | 'book'

function readTrail(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(TRAIL_KEY) || '[]') as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveTrail(trail: string[]) {
  sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail))
}

export function References({ route }: { route: Extract<Route, { name: 'refs' }> }) {
  const state = useAppState()
  const parsed = parseRef(route.id)
  const [trail, setTrail] = useState<string[]>(() => readTrail())
  const [groups, setGroups] = useState<XRefGroup[]>([])
  const [ready, setReady] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    const saved = readTrail()
    if (saved[saved.length - 1] === route.id) setTrail(saved)
    else {
      const next = [route.id]
      saveTrail(next)
      setTrail(next)
    }
  }, [route.id])

  useEffect(() => {
    const current = parseRef(route.id)
    if (!current) return
    let live = true
    setReady(false)
    loadXrefs(current.book).then((file) => {
      if (!live) return
      setGroups(file[`${current.chapter}:${current.verse}`] ?? [])
      setReady(true)
    })
    return () => {
      live = false
    }
  }, [route.id])

  const visible = useMemo(() => {
    const bookId = parseRef(route.id)?.book
    return groups
      .map((group) => ({
        ...group,
        v: group.v.filter((id) => {
          const book = parseRef(id)?.book
          const info = book ? bookById(book) : undefined
          if (!info) return false
          if (filter === 'ot') return info.testament === 'OT'
          if (filter === 'nt') return info.testament === 'NT'
          if (filter === 'book') return book === bookId
          return true
        }),
      }))
      .filter((group) => group.v.length > 0)
  }, [groups, filter, route.id])

  const flat = visible.flatMap((group) => group.v).filter((id, index, list) => list.indexOf(id) === index).slice(0, 10)

  function walk(id: string) {
    const next = [...trail, id]
    saveTrail(next)
    setTrail(next)
    go(`/refs/${id}`)
  }

  function jump(index: number) {
    const next = trail.slice(0, index + 1)
    saveTrail(next)
    setTrail(next)
    go(`/refs/${next[next.length - 1]}`)
  }

  if (!parsed) return <p>That reference cannot be opened.</p>

  return (
    <div>
      <p className="kicker">Treasury of Scripture Knowledge</p>
      <h1>{formatRef(route.id)}</h1>
      <ListenButton
        scriptKey={`refs:${route.id}:${filter}:${state.translation}`}
        title={formatRef(route.id)}
        label="Read all"
        className="choice"
        translation={state.translation}
        lines={() => verseScripts([route.id, ...visible.flatMap((group) => group.v)], state.translation)}
      />
      <div className="trail" aria-label="Trail">
        {trail.map((id, index) => (
          <button key={`${id}-${index}`} type="button" className={index === trail.length - 1 ? 'on' : ''} onClick={() => jump(index)}>
            {shortRef(id)}
          </button>
        ))}
      </div>
      <div className="filters" style={{ margin: '0.8rem 0' }}>
        {(['all', 'ot', 'nt', 'book'] as Filter[]).map((item) => (
          <button key={item} type="button" className={filter === item ? 'on' : ''} onClick={() => setFilter(item)}>
            {item === 'all' ? 'All' : item === 'ot' ? 'Old Testament' : item === 'nt' ? 'New Testament' : 'This book'}
          </button>
        ))}
      </div>
      <Graph center={route.id} links={flat} onOpen={walk} />
      <div className="refs-layout" style={{ marginTop: '1rem' }}>
        <section className="refs-source panel">
          <p className="kicker">Open verse</p>
          <VerseQuote id={route.id} translation={state.translation} />
          <button type="button" className="text-btn" onClick={() => go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)}>
            Open the chapter
          </button>
        </section>
        <section>
          {!ready ? <p className="quiet">Opening the links…</p> : null}
          {ready && visible.length === 0 ? <p className="quiet">No Treasury link matches this filter.</p> : null}
          {visible.map((group) => (
            <section key={group.p}>
              <h2>{group.p}</h2>
              {group.v.map((id) => (
                <div key={id}>
                  <VerseQuote id={id} translation={state.translation} />
                  <button type="button" className="text-btn" onClick={() => walk(id)}>Walk here</button>
                </div>
              ))}
            </section>
          ))}
        </section>
      </div>
    </div>
  )
}

function Graph({ center, links, onOpen }: { center: string; links: string[]; onOpen: (id: string) => void }) {
  if (!links.length) return null
  const width = 360
  const height = 240
  const cx = width / 2
  const cy = height / 2
  return (
    <svg className="graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Reference threads">
      {links.map((id, index) => {
        const angle = (Math.PI * 2 * index) / links.length - Math.PI / 2
        const x = cx + Math.cos(angle) * 112
        const y = cy + Math.sin(angle) * 78
        return (
          <g key={id} onClick={() => onOpen(id)} className="node">
            <line x1={cx} y1={cy} x2={x} y2={y} />
            <circle cx={x} cy={y} r="15" />
            <text x={x} y={y + 30} textAnchor="middle">{shortRef(id)}</text>
          </g>
        )
      })}
      <circle className="hub" cx={cx} cy={cy} r="26" />
      <text x={cx} y={cy + 4} textAnchor="middle">{shortRef(center)}</text>
    </svg>
  )
}
