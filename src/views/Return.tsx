import { useEffect, useRef, useState } from 'react'
import { parseRef } from '../lib/canon'
import { loadGloss, type Gloss, type Translation } from '../lib/bible'
import {
  RETURN_HERO,
  RETURN_TRACKS,
  nowStep,
  readingsOf,
  resolveReturn,
  returnHref,
  returnSequence,
  returnTrack,
  type ReturnSign,
  type ReturnStation,
  type ReturnStep,
  type ReturnViewId,
} from '../lib/return'
import { go, type Route } from '../lib/router'
import { useAppState } from '../lib/storage'
import { WordLesson } from '../teach'
import { VerseQuote } from '../ui'

function calm(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function Scripture({ id, translation }: { id: string; translation: Translation }) {
  const parsed = parseRef(id)
  return (
    <div className="return-scripture">
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

function Node({
  step,
  state,
  seen,
  onPick,
}: {
  step: ReturnStep
  state: 'on' | 'lit' | 'dim' | 'ready'
  seen?: boolean
  onPick: (step: ReturnStep) => void
}) {
  const { station } = step
  return (
    <li>
      <button
        type="button"
        className={['return-hit', state, station.now ? 'now' : '', seen && state !== 'on' ? 'seen' : ''].filter(Boolean).join(' ')}
        data-step={`${step.scope}:${station.id}`}
        aria-current={state === 'on' ? 'step' : undefined}
        onClick={() => onPick(step)}
      >
        <span className="return-link" aria-hidden="true" />
        <span className="return-dot" aria-hidden="true" />
        <strong>{station.title}</strong>
        <small>{station.now ? 'Now' : station.nav}</small>
      </button>
    </li>
  )
}

function nodeState(step: ReturnStep, index: number, active: number, chosen: boolean): 'on' | 'lit' | 'dim' | 'ready' {
  if (!chosen && step.scope !== 'shared') return 'ready'
  if (index === active) return 'on'
  if (index >= 0 && index < active) return 'lit'
  if (index > active) return 'dim'
  return 'ready'
}

export function Return({ route }: { route: Extract<Route, { name: 'return' }> }) {
  const app = useAppState()
  const stage = useRef<HTMLDivElement>(null)
  const lanes = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState<string[]>([])
  const [choosing, setChoosing] = useState(false)
  const resolved = resolveReturn(route.view, route.station)
  const view = resolved.view
  const step = resolved.step
  const sequence = returnSequence(view)
  const index = Math.max(0, sequence.findIndex((item) => item.scope === step.scope && item.station.id === step.station.id))
  const atFork = !view && step.station.id === 'prophets'
  const seenKey = `${step.scope}:${step.station.id}`
  const move = useRef({ forward: () => {}, back: () => {} })

  useEffect(() => {
    setSeen((current) => (current.includes(seenKey) ? current : [...current, seenKey]))
  }, [seenKey])

  useEffect(() => {
    if (step.station.id !== 'prophets' || view) setChoosing(false)
  }, [step.station.id, view])

  useEffect(() => {
    const node = stage.current?.querySelector<HTMLElement>('[aria-current="step"]')
    node?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: calm() })
  }, [view, step.scope, step.station.id])

  useEffect(() => {
    if (!choosing) return
    lanes.current?.querySelector('.return-lane.held .return-lane-pick')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: calm() })
  }, [choosing])

  function pick(next: ReturnStep, mode: 'push' | 'replace' = 'push') {
    const owner: ReturnViewId | null = next.scope === 'shared' ? view : next.scope
    go(returnHref(owner, next.station.id), mode)
  }

  function forward() {
    if (atFork) {
      setChoosing(true)
      return
    }
    const next = sequence[index + 1]
    if (next) pick(next)
  }

  function back() {
    const previous = sequence[index - 1]
    if (previous) pick(previous)
  }

  function openView(id: ReturnViewId) {
    const track = returnTrack(id)
    if (step.station.sign) {
      const match = track.stations.find((item) => item.sign === step.station.sign)
      if (match) {
        go(returnHref(id, match.id))
        return
      }
    }
    if (step.scope === 'shared') {
      go(returnHref(id, step.station.id))
      return
    }
    const landing = track.stations.find((item) => item.now) ?? track.stations[0]
    go(returnHref(id, landing.id))
  }

  move.current = { forward, back }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      if (event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      event.preventDefault()
      if (event.key === 'ArrowRight') move.current.forward()
      else move.current.back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const nextLabel = index === 0 && !view ? 'Walk the line' : atFork ? 'Choose a reading' : index >= sequence.length - 1 ? 'End of this reading' : 'Next'
  const held = RETURN_TRACKS.find((track) => track.held)

  return (
    <div className="return">
      <header className="return-hero">
        <p className="kicker">{RETURN_HERO.kicker}</p>
        <h1>{RETURN_HERO.title}</h1>
        <p className="lede">{RETURN_HERO.lede}</p>
        {held ? (
          <button type="button" className="return-held" onClick={() => pick(nowStep())}>
            <span className="kicker">Our reading</span>
            <strong>Premillennial</strong>
            <span>{held.lede}</span>
          </button>
        ) : null}
      </header>

      <div className="return-views" role="tablist" aria-label="Readings">
        <button type="button" role="tab" aria-selected={!view} className={!view ? 'on' : ''} onClick={() => go(returnHref(null, step.scope === 'shared' ? step.station.id : 'prophets'))}>
          Compare
        </button>
        {[...RETURN_TRACKS].sort((a, b) => Number(Boolean(b.held)) - Number(Boolean(a.held))).map((track) => (
          <button
            key={track.id}
            type="button"
            role="tab"
            aria-selected={view === track.id}
            className={view === track.id ? 'on' : ''}
            onClick={() => openView(track.id)}
          >
            {track.nav}
            {track.held ? <em>Our reading</em> : null}
          </button>
        ))}
      </div>

      <div className="return-stage" ref={stage}>
        <div className={['return-map', view ? 'is-chosen' : 'is-compare', choosing ? 'is-choosing' : ''].filter(Boolean).join(' ')}>
          <ol className="return-nodes return-trunk">
            {sequence.filter((item) => item.scope === 'shared').map((item) => {
              const at = sequence.findIndex((entry) => entry.scope === item.scope && entry.station.id === item.station.id)
              return (
                <Node
                  key={item.station.id}
                  step={item}
                  state={nodeState(item, at, index, true)}
                  seen={seen.includes(`shared:${item.station.id}`)}
                  onPick={pick}
                />
              )
            })}
          </ol>
          <div className="return-lanes" ref={lanes}>
            {RETURN_TRACKS.map((track) => {
              const onLane = view === track.id
              const show = !view || onLane
              if (!show) return null
              return (
                <div key={track.id} className={['return-lane', track.held ? 'held' : '', onLane ? 'on' : ''].filter(Boolean).join(' ')}>
                  {view ? (
                    <p className="return-lane-kicker">
                      {track.title}
                      {track.held ? <em>Our reading</em> : null}
                    </p>
                  ) : (
                    <button type="button" className="return-lane-pick" onClick={() => openView(track.id)}>
                      <strong>{track.title}</strong>
                      {track.held ? <em>Our reading</em> : null}
                      <span>{track.lede}</span>
                    </button>
                  )}
                  <ol className="return-nodes">
                    {track.stations.map((station) => {
                      const laneStep: ReturnStep = { scope: track.id, station }
                      const at = onLane ? sequence.findIndex((entry) => entry.scope === track.id && entry.station.id === station.id) : -1
                      return (
                        <Node
                          key={station.id}
                          step={laneStep}
                          state={nodeState(laneStep, at, index, Boolean(view))}
                          seen={seen.includes(`${track.id}:${station.id}`)}
                          onPick={(next) => pick(view ? next : { scope: track.id, station: next.station })}
                        />
                      )
                    })}
                  </ol>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <Scrubber
        steps={sequence}
        index={index}
        onPick={(at) => {
          const next = sequence[at]
          if (next) pick(next, 'replace')
        }}
        onNow={() => pick(nowStep())}
      />

      <div className="return-walk">
        <button type="button" className="text-btn" onClick={back} disabled={index <= 0}>Back</button>
        <p>
          <span className="kicker">{view ? returnTrack(view).nav : 'Shared'}</span>
          <strong>{step.station.title}</strong>
          <span>{index + 1} / {sequence.length}</span>
        </p>
        <button type="button" className="return-next" onClick={forward} disabled={!atFork && index >= sequence.length - 1}>
          {nextLabel}
        </button>
      </div>

      <Panel station={step.station} view={view} translation={app.translation} onOpen={openView} />
    </div>
  )
}

function Scrubber({
  steps,
  index,
  onPick,
  onNow,
}: {
  steps: ReturnStep[]
  index: number
  onPick: (index: number) => void
  onNow: () => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const now = nowStep()
  const nowIndex = steps.findIndex((step) => step.station.now)

  function atX(clientX: number) {
    const node = track.current
    if (!node || steps.length < 2) return
    const rect = node.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onPick(Math.round(ratio * (steps.length - 1)))
  }

  return (
    <div className="return-scrub-row">
      <button type="button" className={steps[index]?.station.now ? 'return-now on' : 'return-now'} onClick={onNow}>
        Now
      </button>
      <div
        className="return-scrub"
        ref={track}
        onPointerDown={(event) => {
          drag.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          atX(event.clientX)
        }}
        onPointerMove={(event) => {
          if (drag.current) atX(event.clientX)
        }}
        onPointerUp={() => {
          drag.current = false
        }}
        onPointerCancel={() => {
          drag.current = false
        }}
      >
        <span className="return-scrub-fill" style={{ width: `${steps.length < 2 ? 0 : (index / (steps.length - 1)) * 100}%` }} />
        {steps.map((item, at) => (
          <button
            key={`${item.scope}:${item.station.id}:${at}`}
            type="button"
            className={['return-tick', at === index ? 'on' : '', at < index ? 'lit' : '', item.station.now ? 'now' : ''].filter(Boolean).join(' ')}
            style={{ left: `${steps.length < 2 ? 0 : (at / (steps.length - 1)) * 100}%` }}
            aria-label={item.station.now ? `${item.station.title}, now` : item.station.title}
            aria-current={at === index ? 'step' : undefined}
            onClick={(event) => {
              event.stopPropagation()
              onPick(at)
            }}
          />
        ))}
      </div>
      {nowIndex < 0 ? <span className="return-scrub-hint">{now.station.nav} is on his reading</span> : null}
    </div>
  )
}

function CaughtWord({ id }: { id: string }) {
  const [gloss, setGloss] = useState<Gloss | null>(null)

  useEffect(() => {
    let live = true
    loadGloss().then((all) => {
      if (live) setGloss(all[id] ?? null)
    })
    return () => {
      live = false
    }
  }, [id])

  const letters = gloss?.l
  if (!letters) return null
  return (
    <WordLesson
      word={{ w: letters, m: '', s: id }}
      gloss={gloss}
      language="Greek"
    />
  )
}

function Panel({
  station,
  view,
  translation,
  onOpen,
}: {
  station: ReturnStation
  view: ReturnViewId | null
  translation: Translation
  onOpen: (id: ReturnViewId) => void
}) {
  const sign: ReturnSign | undefined = station.sign
  const readings = sign ? readingsOf(sign) : []
  return (
    <article className="return-panel" key={`${view ?? 'shared'}:${station.id}`}>
      <p className="kicker">{station.now ? 'Now' : station.nav}</p>
      <h2>{station.title}</h2>
      <p>{station.claim}</p>
      {station.strong ? <CaughtWord id={station.strong} /> : null}
      {station.note ? <p className="return-note">{station.note}</p> : null}
      {readings.length > 0 ? (
        <div className="return-readings">
          <p className="kicker">Three readings of this sign</p>
          {readings.map((reading) => {
            const track = returnTrack(reading.view)
            const on = view === reading.view && station.id === reading.station.id
            return (
              <button
                key={reading.view}
                type="button"
                className={on ? 'on' : ''}
                aria-current={on ? 'true' : undefined}
                onClick={() => onOpen(reading.view)}
              >
                <strong>
                  {track.nav}
                  {track.held ? <em>Our reading</em> : null}
                </strong>
                <span>{reading.station.line}</span>
              </button>
            )
          })}
        </div>
      ) : null}
      {station.verses.map((id) => (
        <Scripture key={id} id={id} translation={translation} />
      ))}
    </article>
  )
}
