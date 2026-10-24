import { Fragment, useEffect, useRef, useState } from 'react'
import { expandRef, formatRef } from '../lib/canon'
import { loadProphecy, type AheadThread, type FulfilledThread, type ProphecyFile } from '../lib/catalog'
import { PROPHECY_SPANS, nextWalk, spanOf, todayThread, walk, type WalkItem } from '../lib/prophecy'
import { go, type Route } from '../lib/router'
import { markProphecy, useAppState } from '../lib/storage'
import { ListenButton, VerseQuote, verseScripts } from '../ui'

type Arc = { from: string; to: string }

type CardModel = WalkItem & { arcs: Arc[]; chain: string[] }

function calm(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function cardsOf(data: ProphecyFile): CardModel[] {
  return walk(data).map((item) => {
    if (item.kind === 'fulfilled') {
      const thread = data.fulfilled.find((entry) => entry.id === item.id)
      const arcs = (thread?.steps ?? []).map((step) => ({ from: formatRef(step.cited), to: formatRef(step.citing) }))
      return { ...item, arcs, chain: [] }
    }
    const thread = data.ahead.find((entry) => entry.id === item.id)
    return { ...item, arcs: [], chain: (thread?.verses ?? []).map((id) => formatRef(id)) }
  })
}

function mentions(data: ProphecyFile, item: WalkItem, verse: string): boolean {
  if (item.kind === 'fulfilled') {
    const thread = data.fulfilled.find((entry) => entry.id === item.id)
    return thread?.steps.some((step) => [...expandRef(step.cited), ...expandRef(step.citing)].includes(verse)) ?? false
  }
  const thread = data.ahead.find((entry) => entry.id === item.id)
  return thread?.verses.some((id) => expandRef(id).includes(verse)) ?? false
}

function focusRail(node: HTMLElement | null) {
  const on = node?.querySelector<HTMLButtonElement>('button.on')
  if (!node || !on) return
  const left = on.offsetLeft - node.clientWidth / 2 + on.clientWidth / 2
  node.scrollTo({ left: Math.max(0, left) })
}

function Rail({ current }: { current?: string }) {
  const rail = useRef<HTMLElement>(null)

  useEffect(() => {
    focusRail(rail.current)
  }, [current])

  return (
    <nav className="prophecy-rail" aria-label="Spans" ref={rail}>
      <button type="button" className={current ? '' : 'on'} onClick={() => go('/prophecy')}>
        The path
      </button>
      {PROPHECY_SPANS.map((span) => (
        <button
          key={span.id}
          type="button"
          className={span.id === current ? 'on' : ''}
          aria-current={span.id === current ? 'location' : undefined}
          onClick={() => go(`/prophecy/span/${span.id}`)}
        >
          {span.nav}
        </button>
      ))}
    </nav>
  )
}

function EraStrip({ current, today, counts }: { current?: string; today?: string; counts: Record<string, number> }) {
  const strip = useRef<HTMLElement>(null)

  useEffect(() => {
    const node = strip.current
    const on = node?.querySelector<HTMLButtonElement>('button.on') ?? node?.querySelector<HTMLButtonElement>('button.today')
    if (!node || !on) return
    const left = on.offsetLeft - node.clientWidth / 2 + on.clientWidth / 2
    node.scrollTo({ left: Math.max(0, left) })
  }, [current, today])

  return (
    <nav className="prophecy-strip" aria-label="The story" ref={strip}>
      {PROPHECY_SPANS.map((span) => {
        const on = span.id === current
        const isToday = span.id === today
        return (
          <button
            key={span.id}
            type="button"
            className={['prophecy-era', on ? 'on' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')}
            aria-current={on ? 'location' : undefined}
            onClick={() => go(`/prophecy/span/${span.id}`)}
          >
            <span className="prophecy-era-dot" aria-hidden="true" />
            <span className="prophecy-era-name">{span.nav}</span>
            <span className={isToday ? 'prophecy-era-meta today' : 'prophecy-era-meta'}>{isToday ? 'Today' : counts[span.id] ?? 0}</span>
          </button>
        )
      })}
    </nav>
  )
}

function ArcLine({ card }: { card: CardModel }) {
  if (card.kind === 'ahead') {
    return (
      <span className="prophecy-arc">
        {card.chain.map((label, index) => (
          <Fragment key={`${card.id}-${label}`}>
            {index > 0 ? <span className="prophecy-rule" aria-hidden="true" /> : null}
            <span>{label}</span>
          </Fragment>
        ))}
      </span>
    )
  }
  return (
    <span className="prophecy-arcs">
      {card.arcs.map((arc) => (
        <span className="prophecy-arc" key={`${arc.from}-${arc.to}`}>
          <span>{arc.from}</span>
          <span className="prophecy-rule" aria-hidden="true" />
          <span>{arc.to}</span>
        </span>
      ))}
    </span>
  )
}

function Path({
  spanId,
  cards,
  seen,
}: {
  spanId: string
  cards: CardModel[]
  seen: ReadonlySet<string>
}) {
  const span = spanOf(spanId)
  if (!span || !cards.length) return null
  const open = span.kind === 'ahead'
  return (
    <section className="prophecy-span" id={`prophecy-span-${span.id}`}>
      <p className="kicker">{open ? 'Still before you' : 'Recorded in Scripture'} · {cards.length}</p>
      <h2>{span.title}</h2>
      <p className="quiet prophecy-line-note">{span.line}</p>
      <ol className={open ? 'prophecy-path open' : 'prophecy-path'}>
        {cards.map((card, index) => {
          const opened = seen.has(card.id)
          return (
            <li key={card.id}>
              <span className={opened ? 'prophecy-n on' : 'prophecy-n'} aria-hidden="true">{index + 1}</span>
              <button type="button" className={opened ? 'prophecy-card seen' : 'prophecy-card'} onClick={() => go(`/prophecy/thread/${card.id}`)}>
                {opened ? <span className="prophecy-seen">Opened</span> : null}
                <strong>{card.title}</strong>
                <ArcLine card={card} />
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Index({
  data,
  span,
  seenIds,
  last,
}: {
  data: ProphecyFile
  span?: string
  seenIds: string[]
  last: string
}) {
  const cards = cardsOf(data)
  const known = new Set(cards.map((card) => card.id))
  const seen = new Set(seenIds.filter((id) => known.has(id)))
  const opened = seen.size
  const recorded = data.fulfilled.length
  const ahead = data.ahead.length
  const total = cards.length
  const today = todayThread(data)
  const resume = cards.find((card) => card.id === last) ?? cards[0]
  const begun = Boolean(last && known.has(last))
  const fill = total ? Math.round((opened / total) * 100) : 0

  return (
    <div className="prophecy">
      <section className="prophecy-hero">
        <p className="kicker">Prophecy</p>
        <h1>What the Scriptures say came, and what they still speak of</h1>
        <p className="lede">Each thread is a word spoken, then a later word that takes it up. What is still ahead stays open.</p>
        <ul className="prophecy-facts">
          <li>
            <strong>{recorded}</strong>
            <span>Recorded</span>
          </li>
          <li>
            <strong>{ahead}</strong>
            <span>Still ahead</span>
          </li>
          <li>
            <strong>{opened}</strong>
            <span>Opened</span>
          </li>
        </ul>
        <div
          className="prophecy-meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={opened}
          aria-valuetext={`${opened} of ${total} threads opened`}
          aria-label="Threads opened"
        >
          <span style={{ width: `${fill}%` }} />
        </div>
        <div className="prophecy-doors">
          {resume ? (
            <button type="button" className="prophecy-door" onClick={() => go(`/prophecy/thread/${resume.id}`)}>
              <span className="kicker">{begun ? 'Continue' : 'Begin'}</span>
              <strong>{resume.title}</strong>
              <span>{spanOf(resume.section)?.title}</span>
            </button>
          ) : null}
          {today ? (
            <button type="button" className="prophecy-door" onClick={() => go(`/prophecy/thread/${today.id}`)}>
              <span className="kicker">Today</span>
              <strong>{today.title}</strong>
              <span>{spanOf(today.section)?.line}</span>
            </button>
          ) : null}
        </div>
        <EraStrip
          current={span}
          today={today?.section}
          counts={Object.fromEntries(PROPHECY_SPANS.map((item) => [item.id, cards.filter((card) => card.section === item.id).length]))}
        />
      </section>
      <Rail current={span} />
      {PROPHECY_SPANS.map((item) => (
        <Path key={item.id} spanId={item.id} cards={cards.filter((card) => card.section === item.id)} seen={seen} />
      ))}
    </div>
  )
}

function VerseHits({ data, verse, seenIds }: { data: ProphecyFile; verse: string; seenIds: string[] }) {
  const cards = cardsOf(data).filter((card) => mentions(data, card, verse))
  const seen = new Set(seenIds)
  const spans = PROPHECY_SPANS.filter((span) => cards.some((card) => card.section === span.id))
  return (
    <div className="prophecy">
      <button type="button" className="text-btn" onClick={() => go('/prophecy')}>All prophecy</button>
      <p className="kicker">Prophecy</p>
      <h1>{formatRef(verse)}</h1>
      {cards.length === 0 ? <p className="quiet">No prophecy thread in this app names this verse.</p> : null}
      {spans.map((span) => (
        <Path key={span.id} spanId={span.id} cards={cards.filter((card) => card.section === span.id)} seen={seen} />
      ))}
    </div>
  )
}

function NextThread({ data, item }: { data: ProphecyFile; item: WalkItem }) {
  const next = nextWalk(data, item.id)
  if (!next) {
    return (
      <footer className="prophecy-next">
        <p className="kicker">The path</p>
        <h2>Still before you</h2>
        <p className="quiet">The words themselves are still set before the reader.</p>
        <button type="button" className="choice gold" onClick={() => go('/prophecy')}>Back to the path</button>
      </footer>
    )
  }
  const span = spanOf(next.section)
  const same = next.section === item.section
  const thread = next.kind === 'fulfilled'
    ? data.fulfilled.find((entry) => entry.id === next.id)
    : null
  const ahead = next.kind === 'ahead' ? data.ahead.find((entry) => entry.id === next.id) : null
  const step = thread?.steps[0]
  const detail = same
    ? step
      ? `${formatRef(step.cited)} · ${formatRef(step.citing)}`
      : (ahead?.verses.map((id) => formatRef(id)).join(' · ') ?? '')
    : (span?.line ?? '')
  return (
    <footer className="prophecy-next">
      <p className="kicker">{same ? 'Next' : (span?.title ?? 'Next')}</p>
      <h2>{next.title}</h2>
      {detail ? <p className="quiet">{detail}</p> : null}
      <button type="button" className="choice gold" onClick={() => go(`/prophecy/thread/${next.id}`)}>Continue</button>
    </footer>
  )
}

function FulfilledView({ thread, data }: { thread: FulfilledThread; data: ProphecyFile }) {
  const state = useAppState()
  const span = spanOf(thread.section)
  useEffect(() => {
    markProphecy(thread.id)
  }, [thread.id])
  return (
    <div className="prophecy">
      <button type="button" className="text-btn" onClick={() => go(span ? `/prophecy/span/${span.id}` : '/prophecy')}>
        {span?.title ?? 'All prophecy'}
      </button>
      <p className="kicker">Recorded in Scripture</p>
      <h1>{thread.title}</h1>
      <div className="prophecy-listen">
        <ListenButton
          scriptKey={`prophecy:${thread.id}:${state.translation}`}
          title={thread.title}
          label="Read all"
          className="choice"
          translation={state.translation}
          lines={() => verseScripts(thread.steps.flatMap((step) => [step.cited, step.citing]), state.translation)}
        />
      </div>
      <ol className="prophecy-line">
        {thread.steps.map((step, index) => (
          <Fragment key={`${step.cited}-${step.citing}-${index}`}>
            <li>
              <span className="prophecy-dot" aria-hidden="true" />
              <p className="kicker">Spoken</p>
              <VerseQuote id={step.cited} translation={state.translation} />
            </li>
            <li>
              <span className="prophecy-dot filled" aria-hidden="true" />
              <p className="kicker">Taken up</p>
              <VerseQuote id={step.citing} translation={state.translation} />
            </li>
          </Fragment>
        ))}
      </ol>
      <NextThread data={data} item={{ kind: 'fulfilled', id: thread.id, title: thread.title, section: thread.section }} />
    </div>
  )
}

function AheadView({ thread, data }: { thread: AheadThread; data: ProphecyFile }) {
  const state = useAppState()
  const span = spanOf(thread.section)
  useEffect(() => {
    markProphecy(thread.id)
  }, [thread.id])
  return (
    <div className="prophecy">
      <button type="button" className="text-btn" onClick={() => go(span ? `/prophecy/span/${span.id}` : '/prophecy')}>
        {span?.title ?? 'All prophecy'}
      </button>
      <p className="kicker">Spoken of as ahead</p>
      <h1>{thread.title}</h1>
      <div className="prophecy-listen">
        <ListenButton
          scriptKey={`prophecy:${thread.id}:${state.translation}`}
          title={thread.title}
          label="Read all"
          className="choice"
          translation={state.translation}
          lines={() => verseScripts(thread.verses, state.translation)}
        />
      </div>
      <ol className="prophecy-line open">
        {thread.verses.map((id) => (
          <li key={id}>
            <span className="prophecy-dot" aria-hidden="true" />
            <VerseQuote id={id} translation={state.translation} />
          </li>
        ))}
        <li className="prophecy-rest">
          <span className="prophecy-dot" aria-hidden="true" />
          <p className="kicker">Still before you</p>
          <p className="quiet">These words are still set before the reader.</p>
        </li>
      </ol>
      <NextThread data={data} item={{ kind: 'ahead', id: thread.id, title: thread.title, section: thread.section }} />
    </div>
  )
}

export function ProphecyPage({ route }: { route: Extract<Route, { name: 'prophecy' | 'thread' | 'prophecy-verse' }> }) {
  const state = useAppState()
  const [data, setData] = useState<ProphecyFile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    loadProphecy()
      .then((next) => {
        if (live) setData(next)
      })
      .catch(() => {
        if (live) setError('The prophecy list is not on the device.')
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const header = document.querySelector('.top')
    if (!(header instanceof HTMLElement)) return
    const apply = () => {
      document.documentElement.style.setProperty('--prophecy-stick', `${Math.ceil(header.getBoundingClientRect().height)}px`)
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
    if (route.name === 'prophecy' && route.span && spanOf(route.span)) {
      if (!data) return
      const node = document.getElementById(`prophecy-span-${route.span}`)
      if (node) {
        node.scrollIntoView({ block: 'start', behavior: calm() })
        return
      }
    }
    window.scrollTo(0, 0)
  }, [route, data])

  if (error) return <p className="miss">{error}</p>
  if (!data) return <p className="quiet">Opening the list…</p>

  if (route.name === 'thread') {
    const fulfilled = data.fulfilled.find((item) => item.id === route.id)
    if (fulfilled) return <FulfilledView thread={fulfilled} data={data} />
    const ahead = data.ahead.find((item) => item.id === route.id)
    if (ahead) return <AheadView thread={ahead} data={data} />
    return (
      <div className="prophecy">
        <button type="button" className="text-btn" onClick={() => go('/prophecy')}>All prophecy</button>
        <p>That thread is not in the list.</p>
      </div>
    )
  }

  if (route.name === 'prophecy-verse') {
    return <VerseHits data={data} verse={route.id} seenIds={state.prophecy.seen} />
  }

  if (route.span && !spanOf(route.span)) {
    return (
      <div className="prophecy">
        <Rail />
        <p className="miss">That part of the path is not here.</p>
      </div>
    )
  }

  return <Index data={data} span={route.span} seenIds={state.prophecy.seen} last={state.prophecy.last} />
}
