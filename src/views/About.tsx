import { useEffect, useRef, useState } from 'react'
import {
  ABOUT_CLOSE,
  ABOUT_COPIES,
  ABOUT_COPIES_LEDE,
  ABOUT_DOORS,
  ABOUT_FATHERS,
  ABOUT_HERO,
  ABOUT_LINKS,
  ABOUT_PAIRS,
  ABOUT_SCALE,
  ABOUT_STATIONS,
  ABOUT_STATS,
  ABOUT_WRITERS,
  ABOUT_WRITERS_NOTE,
  type AboutWriter,
} from '../lib/about'
import type { Translation } from '../lib/bible'
import { go } from '../lib/router'
import { useAppState } from '../lib/storage'
import { VerseQuote } from '../ui'

function calm(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function motionOk(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function show(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: calm(), block: 'start' })
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

function useRise() {
  const [values, setValues] = useState(() => (
    motionOk() ? ABOUT_STATS.map(() => 0) : ABOUT_STATS.map((stat) => stat.value)
  ))

  useEffect(() => {
    const finals = ABOUT_STATS.map((stat) => stat.value)
    if (!motionOk()) {
      setValues(finals)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100)
      const eased = 1 - (1 - t) ** 3
      setValues(finals.map((target) => Math.round(target * eased)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return values
}

function Figures() {
  const values = useRise()
  return (
    <ul className="about-facts">
      {ABOUT_STATS.map((stat, index) => {
        const shown = formatCount(values[index] ?? stat.value)
        const name = stat.soft ? `About ${formatCount(stat.value)} ${stat.label}` : `${formatCount(stat.value)} ${stat.label}`
        return (
          <li key={stat.label} aria-label={name}>
            <span className="about-soft" aria-hidden="true">{stat.soft ? 'About' : '\u00a0'}</span>
            <strong>{shown}</strong>
            <span>{stat.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

function Writers({ translation }: { translation: Translation }) {
  const [current, setCurrent] = useState(ABOUT_WRITERS[0]?.id ?? '')
  const rail = useRef<HTMLElement>(null)
  const selected = ABOUT_WRITERS.find((writer) => writer.id === current) ?? ABOUT_WRITERS[0]

  useEffect(() => {
    const node = rail.current
    const on = node?.querySelector<HTMLButtonElement>('button.on')
    if (!node || !on) return
    const left = on.offsetLeft - node.clientWidth / 2 + on.clientWidth / 2
    node.scrollTo({ left: Math.max(0, left), behavior: calm() })
  }, [current])

  return (
    <section id="writers">
      <p className="kicker">The voices</p>
      <h2>They were not in the room</h2>
      <p className="lede">From Egypt to Babylon to Rome, they tell one story.</p>
      <p className="quiet">{ABOUT_WRITERS_NOTE}</p>
      <nav className="about-rail" aria-label="Writers" ref={rail}>
        {ABOUT_WRITERS.map((writer) => {
          const on = writer.id === selected?.id
          return (
            <button
              key={writer.id}
              type="button"
              className={on ? 'about-voice on' : 'about-voice'}
              aria-pressed={on}
              onClick={() => setCurrent(writer.id)}
            >
              <strong>{writer.nav}</strong>
              <span>{writer.era}</span>
            </button>
          )
        })}
      </nav>
      {selected ? <WriterOpen writer={selected} translation={translation} /> : null}
    </section>
  )
}

function WriterOpen({ writer, translation }: { writer: AboutWriter; translation: Translation }) {
  return (
    <div className="about-voice-open">
      <p className="kicker">{writer.era}</p>
      <h3>{writer.name}</h3>
      <p className="quiet about-meta">{writer.place} · {writer.books}</p>
      <p>{writer.line}</p>
      <VerseQuote key={writer.verse} id={writer.verse} translation={translation} />
    </div>
  )
}

function Plot({ translation }: { translation: Translation }) {
  return (
    <section id="plot">
      <p className="kicker">The story</p>
      <h2>One plot</h2>
      <p className="lede">From the first promise to the throne, the subject is the same.</p>
      <ol className="about-path">
        {ABOUT_STATIONS.map((station, index) => (
          <li key={station.title}>
            <span className="about-n" aria-hidden="true">{index + 1}</span>
            <h3>{station.title}</h3>
            <p className="quiet about-line">{station.line}</p>
            {station.verses.map((id) => (
              <VerseQuote key={id} id={id} translation={translation} />
            ))}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Spoken({ translation }: { translation: Translation }) {
  return (
    <section id="spoken">
      <p className="kicker">The words</p>
      <h2>Spoken, then it happened</h2>
      <p className="lede">A word is set down. A later book takes it up, and says that it happened.</p>
      <div className="about-pairs">
        {ABOUT_PAIRS.map((pair) => (
          <article className="about-pair" key={pair.id}>
            <header>
              <h3>{pair.title}</h3>
              <p className="quiet">{pair.line}</p>
            </header>
            <div className="about-pair-verses">
              <VerseQuote id={pair.older} translation={translation} />
              <span className="about-then">Then</span>
              <VerseQuote id={pair.later} translation={translation} />
            </div>
            <button type="button" className="choice" onClick={() => go(`/prophecy/thread/${pair.id}`)}>
              Open this thread
            </button>
          </article>
        ))}
      </div>
      <button type="button" className="about-door" onClick={() => go('/prophecy')}>
        <span className="kicker">The path</span>
        <strong>Every thread</strong>
        <span>Spoken, then taken up.</span>
      </button>
    </section>
  )
}

function Links({ translation }: { translation: Translation }) {
  return (
    <section id="links">
      <p className="kicker">The links</p>
      <h2>They cite one another</h2>
      <p className="lede">{ABOUT_LINKS.lede}</p>
      <VerseQuote id={ABOUT_LINKS.verse} translation={translation} />
      <p className="quiet">{ABOUT_LINKS.note}</p>
      <button type="button" className="choice gold" onClick={() => go(ABOUT_LINKS.href)}>
        {ABOUT_LINKS.action}
      </button>
    </section>
  )
}

function Copies() {
  return (
    <section id="copies">
      <p className="kicker">The copies</p>
      <h2>The text we still have</h2>
      <p className="lede">{ABOUT_COPIES_LEDE}</p>
      <div className="about-copies">
        {ABOUT_COPIES.map((copy) => (
          <article className="about-copy" key={copy.title}>
            <h3>{copy.title}</h3>
            <strong>{copy.figure}</strong>
            <p>{copy.line}</p>
          </article>
        ))}
      </div>
      <p className="kicker about-scale-label">For scale</p>
      <div className="about-copies about-scale">
        {ABOUT_SCALE.map((copy) => (
          <article className="about-copy" key={copy.title}>
            <h3>{copy.title}</h3>
            <strong>{copy.figure}</strong>
            <p>{copy.line}</p>
          </article>
        ))}
      </div>
      <p>{ABOUT_FATHERS}</p>
    </section>
  )
}

export function About() {
  const state = useAppState()
  const translation = state.translation

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="about">
      <section className="about-hero">
        <p className="kicker">{ABOUT_HERO.kicker}</p>
        <h1>{ABOUT_HERO.title}</h1>
        <p className="lede">{ABOUT_HERO.lede}</p>
        <Figures />
        <VerseQuote id={ABOUT_HERO.verse} translation={translation} />
        <div className="about-doors">
          {ABOUT_DOORS.map((door) => (
            <button key={door.id} type="button" className="about-door" onClick={() => show(door.id)}>
              <span className="kicker">{door.kicker}</span>
              <strong>{door.title}</strong>
              <span>{door.line}</span>
            </button>
          ))}
        </div>
      </section>
      <Writers translation={translation} />
      <Plot translation={translation} />
      <Spoken translation={translation} />
      <Links translation={translation} />
      <Copies />
      <footer className="about-close">
        <p className="kicker">Begin</p>
        <h2>Open the book</h2>
        <div className="about-doors">
          {ABOUT_CLOSE.map((door) => (
            <button key={door.href} type="button" className="about-door" onClick={() => go(door.href)}>
              <span className="kicker">{door.kicker}</span>
              <strong>{door.title}</strong>
              <span>{door.line}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  )
}
