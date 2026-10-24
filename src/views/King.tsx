import { useEffect, useRef, useState } from 'react'
import { bookName, parseRef } from '../lib/canon'
import { readPassage, type Translation } from '../lib/bible'
import {
  KING_CHAMBERS,
  KING_DOORS,
  KING_HERO,
  KING_KEEP,
  KING_NAMES,
  KING_READS,
  KING_STATIONS,
  kingChamber,
  kingNext,
  type KingChamber,
} from '../lib/king'
import { go, type Route } from '../lib/router'
import { addMemory, useAppState } from '../lib/storage'
import { VerseQuote } from '../ui'

function Scripture({ id, translation }: { id: string; translation: Translation }) {
  const parsed = parseRef(id)
  return (
    <div className="king-scripture">
      <VerseQuote id={id} translation={translation} />
      {parsed ? (
        <div className="row">
          <button type="button" className="text-btn" onClick={() => go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)}>
            Open the chapter
          </button>
          <button type="button" className="text-btn" onClick={() => go(`/study/${parsed.book}/${parsed.chapter}/${parsed.verse}`)}>
            Study this verse
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Rail({ current }: { current?: string }) {
  const rail = useRef<HTMLElement>(null)

  useEffect(() => {
    const node = rail.current
    const on = node?.querySelector<HTMLButtonElement>('button.on')
    if (!node || !on) return
    const left = on.offsetLeft - node.clientWidth / 2 + on.clientWidth / 2
    node.scrollTo({ left: Math.max(0, left) })
  }, [current])

  return (
    <nav className="king-rail" aria-label="Chambers" ref={rail}>
      <button type="button" className={current ? '' : 'on'} onClick={() => go('/king')}>
        The path
      </button>
      {KING_CHAMBERS.map((chamber) => (
        <button
          key={chamber.id}
          type="button"
          className={chamber.id === current ? 'on' : ''}
          aria-current={chamber.id === current ? 'page' : undefined}
          onClick={() => go(`/king/${chamber.id}`)}
        >
          {chamber.nav}
        </button>
      ))}
    </nav>
  )
}

function Pieces({ chamber, translation }: { chamber: KingChamber; translation: Translation }) {
  return (
    <>
      {chamber.pieces.map((piece, index) =>
        piece.kind === 'prose' ? (
          <p key={`${chamber.id}-p-${index}`}>{piece.text}</p>
        ) : (
          <Scripture key={piece.id} id={piece.id} translation={translation} />
        ),
      )}
    </>
  )
}

function Names({ translation }: { translation: Translation }) {
  const [open, setOpen] = useState<string | null>(null)
  const reveal = useRef<HTMLDivElement>(null)
  const selected = KING_NAMES.find((name) => name.title === open) ?? null

  useEffect(() => {
    if (!selected) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reveal.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [selected])

  return (
    <div className="king-gallery">
      <div className="king-names">
        {KING_NAMES.map((name) => {
          const on = open === name.title
          return (
            <button
              key={name.title}
              type="button"
              className={on ? 'on' : ''}
              aria-pressed={on}
              onClick={() => setOpen(on ? null : name.title)}
            >
              <strong>{name.title}</strong>
              <span>{name.line}</span>
            </button>
          )
        })}
      </div>
      {selected ? (
        <div className="king-name-open" ref={reveal}>
          <p className="kicker">{selected.title}</p>
          {selected.verses.map((id) => (
            <Scripture key={id} id={id} translation={translation} />
          ))}
        </div>
      ) : (
        <p className="quiet">Choose a name to read what Scripture says.</p>
      )}
    </div>
  )
}

function Story({ translation }: { translation: Translation }) {
  return (
    <ol className="king-path">
      {KING_STATIONS.map((station, index) => (
        <li key={station.title}>
          <span className="king-n" aria-hidden="true">{index + 1}</span>
          <h2>{station.title}</h2>
          <p className="quiet king-line">{station.line}</p>
          {station.verses.map((id) => (
            <Scripture key={id} id={id} translation={translation} />
          ))}
          <button type="button" className="choice" onClick={() => go(`/read/${station.book}/${station.chapter}`)}>
            Open {bookName(station.book)} {station.chapter}
          </button>
        </li>
      ))}
    </ol>
  )
}

function KeepVerse({ id, translation }: { id: string; translation: Translation }) {
  const [note, setNote] = useState('')
  const [tone, setTone] = useState<'quiet' | 'miss'>('quiet')
  const [busy, setBusy] = useState(false)

  async function keep() {
    setBusy(true)
    setNote('')
    try {
      const rows = await readPassage(translation, id)
      if (!rows.length) {
        setTone('miss')
        setNote('This verse did not load.')
        return
      }
      const text = rows.map((row) => row.text).join(' ')
      const kept = addMemory(rows[0].translation, rows.map((row) => row.id), text)
      if (!kept) {
        setTone('miss')
        setNote('Saved ESV text stays within 500 verses, the limit Crossway sets for a copy kept on this device.')
        return
      }
      setTone('quiet')
      setNote('Kept. It is in Memory.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="king-keep">
      <Scripture id={id} translation={translation} />
      <div className="row">
        <button type="button" className="choice gold" disabled={busy} onClick={() => void keep()}>
          {busy ? 'Keeping…' : 'Keep this verse'}
        </button>
        <button type="button" className="choice" onClick={() => go('/memorize')}>
          Open Memory
        </button>
      </div>
      {note ? <p className={tone}>{note}</p> : null}
    </div>
  )
}

function Begin({ translation }: { translation: Translation }) {
  return (
    <>
      <h2>A first reading</h2>
      <div className="king-reads">
        {KING_READS.map((item) => (
          <button
            key={item.title}
            type="button"
            className="king-read"
            onClick={() => go(`/read/${item.book}/${item.chapter}`)}
          >
            <strong>{item.title}</strong>
            <span>{item.line}</span>
          </button>
        ))}
      </div>
      <h2>Keep these</h2>
      {KING_KEEP.map((id) => (
        <KeepVerse key={id} id={id} translation={translation} />
      ))}
    </>
  )
}

function Next({ chamber }: { chamber: KingChamber }) {
  const next = kingNext(chamber.id)
  if (!next) {
    return (
      <footer className="king-next">
        <p className="kicker">The path</p>
        <h2>Stay with him</h2>
        <p className="quiet">Open John, or return to the path.</p>
        <div className="row">
          <button type="button" className="choice gold" onClick={() => go('/read/JHN/1')}>Open John</button>
          <button type="button" className="choice" onClick={() => go('/king')}>Back to the King</button>
        </div>
      </footer>
    )
  }
  return (
    <footer className="king-next">
      <p className="kicker">Next</p>
      <h2>{next.title}</h2>
      <p className="quiet">{next.line}</p>
      <button type="button" className="choice gold" onClick={() => go(`/king/${next.id}`)}>
        Continue
      </button>
    </footer>
  )
}

function Landing({ translation }: { translation: Translation }) {
  return (
    <div className="king">
      <section className="king-hero">
        <p className="kicker">{KING_HERO.kicker}</p>
        <h1>{KING_HERO.title}</h1>
        <p className="lede">{KING_HERO.lede}</p>
        <div className="king-voices">
          {KING_HERO.verses.map((id) => (
            <Scripture key={id} id={id} translation={translation} />
          ))}
        </div>
        <div className="king-doors">
          {KING_DOORS.map((door) => (
            <button key={door.section} type="button" className="king-door" onClick={() => go(`/king/${door.section}`)}>
              <span className="kicker">{door.kicker}</span>
              <strong>{door.title}</strong>
              <span>{door.line}</span>
            </button>
          ))}
        </div>
      </section>
      <Rail />
      <h2>The path</h2>
      <ol className="king-path">
        {KING_CHAMBERS.map((chamber, index) => (
          <li key={chamber.id}>
            <span className="king-n" aria-hidden="true">{index + 1}</span>
            <button type="button" className="king-stop" onClick={() => go(`/king/${chamber.id}`)}>
              <strong>{chamber.title}</strong>
              <span>{chamber.line}</span>
            </button>
            <Scripture id={chamber.verse} translation={translation} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function Chamber({ chamber, translation }: { chamber: KingChamber; translation: Translation }) {
  return (
    <div className="king">
      <p className="kicker">King of kings</p>
      <h1>{chamber.title}</h1>
      <p className="lede">{chamber.lede}</p>
      <Rail current={chamber.id} />
      <Pieces chamber={chamber} translation={translation} />
      {chamber.id === 'names' ? <Names translation={translation} /> : null}
      {chamber.id === 'story' ? <Story translation={translation} /> : null}
      {chamber.id === 'begin' ? <Begin translation={translation} /> : null}
      <Next chamber={chamber} />
    </div>
  )
}

export function King({ route }: { route: Extract<Route, { name: 'king' }> }) {
  const state = useAppState()
  const chamber = kingChamber(route.section)

  useEffect(() => {
    const header = document.querySelector('.top')
    if (!(header instanceof HTMLElement)) return
    const apply = () => {
      document.documentElement.style.setProperty('--king-stick', `${Math.ceil(header.getBoundingClientRect().height)}px`)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(header)
    window.addEventListener('resize', apply)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.section])

  if (route.section && !chamber) {
    return (
      <div className="king">
        <Rail />
        <p className="miss">That part of the path is not here.</p>
      </div>
    )
  }

  if (!chamber) return <Landing translation={state.translation} />
  return <Chamber chamber={chamber} translation={state.translation} />
}
