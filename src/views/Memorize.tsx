import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from 'react'
import { translationShort } from '../lib/bible'
import { go } from '../lib/router'
import { getVoice, pauseVoice, resumeVoice, startScript, stopVoice, useVoice } from '../lib/speech'
import {
  dueCards,
  gradeFromAccuracy,
  isLearning,
  memoryStrength,
  phraseRuns,
  phraseWordIndexes,
  sameWord,
  wordPrefix,
  strengthLabel,
  versePieces,
  wordIndexAt,
  type MemoryCard,
  type PhraseRun,
  type VersePiece,
} from '../lib/srs'
import { releaseMemory, reviewMemory, shownStreak, useAppState } from '../lib/storage'
import { EsvNotice, NivNotice } from '../ui'

type Drill = 'read' | 'fade' | 'letters' | 'write'
type Help = 0 | 1 | 2
type Lock = 'ok' | 'hint' | null

type Session = {
  id: string
  step: Drill
  help: Help
  shown: number[]
}

type Result = {
  card: MemoryCard
  accuracy: number
  grade: number
  before: number
  capped: boolean
  rehearsed: boolean
}

const STEPS: { id: Drill; label: string }[] = [
  { id: 'read', label: 'Read' },
  { id: 'fade', label: 'Fade' },
  { id: 'letters', label: 'Letters' },
  { id: 'write', label: 'Write' },
]

export type ReciteHandle = {
  revealCurrent: () => void
  accuracy: () => number
  cursor: () => number
}

function raise(help: Help, next: Help): Help {
  return help > next ? help : next
}

function verdict(grade: number): string {
  if (grade >= 5) return 'Word for word.'
  if (grade >= 4) return 'Nearly sealed.'
  if (grade >= 3) return 'It holds.'
  if (grade >= 2) return 'Still forming.'
  return 'Taken up again.'
}

function whenDue(due: number, now = Date.now()): { label: string; dueNow: boolean } {
  if (due <= now) return { label: 'Due now', dueNow: true }
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const day = new Date(due)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((day.getTime() - start.getTime()) / 86400000)
  if (diff <= 0) return { label: 'Returns today', dueNow: false }
  if (diff === 1) return { label: 'Returns tomorrow', dueNow: false }
  return { label: `Returns ${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, dueNow: false }
}

function longDate(time: number): string {
  return new Date(time).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

function cssVars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties
}

export function Memorize() {
  const state = useAppState()
  const voice = useVoice()
  const due = useMemo(() => dueCards(state.deck), [state.deck])
  const [session, setSession] = useState<Session | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [rehearse, setRehearse] = useState(false)
  const [seen, setSeen] = useState<string | null>(null)
  const [veiled, setVeiled] = useState(false)
  const [veilRun, setVeilRun] = useState(0)
  const [mark, setMark] = useState({ cursor: 0, total: 0 })
  const recite = useRef<ReciteHandle>(null)
  const sealed = useRef(false)
  const helpRef = useRef<Help>(0)
  const rehearseRef = useRef(false)

  const card = (session ? state.deck.find((item) => item.id === session.id) : null) ?? due[0] ?? null
  const aligned = Boolean(card && session?.id === card.id)
  const learning = card ? isLearning(card) : true
  const step: Drill = aligned && session ? session.step : !card || learning ? 'read' : 'write'
  const help: Help = aligned && session ? session.help : card && seen === card.id && !learning ? 2 : 0
  const shown = aligned && session ? session.shown : []
  helpRef.current = help
  rehearseRef.current = rehearse

  const pieces = useMemo(() => (card ? versePieces(card.text) : []), [card])
  const runs = useMemo(() => phraseRuns(pieces), [pieces])
  const fadePhrases = useMemo(() => runs.filter((run) => run.phrase >= 0), [runs])
  const wordCount = pieces.filter((piece) => piece.kind === 'word').length
  const strength = card ? memoryStrength(card) : 0
  const streak = shownStreak(state.streak)
  const onQueue = card ? due.some((item) => item.id === card.id) : false

  useEffect(() => {
    if (step !== 'fade' || !card) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setVeiled(true)
      return
    }
    setVeiled(false)
    const id = window.setTimeout(() => setVeiled(true), 880)
    return () => window.clearTimeout(id)
  }, [step, card?.id, veilRun])

  useEffect(() => {
    if (step === 'read' || result) return
    if (getVoice().status === 'playing') pauseVoice()
  }, [step, result])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const index = ['1', '2', '3', '4'].indexOf(event.key)
      if (index < 0 || result || !card) return
      event.preventDefault()
      goStep(STEPS[index].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function goStep(next: Drill) {
    if (!card) return
    let nextHelp = help
    if (!learning) {
      if (next === 'letters') nextHelp = raise(nextHelp, 1)
      if (next === 'read' || next === 'fade') nextHelp = raise(nextHelp, 2)
    }
    setMark({ cursor: 0, total: wordCount })
    setSession({ id: card.id, step: next, help: nextHelp, shown: session?.id === card.id ? session.shown : [] })
  }

  function revealPhrase(indexes: number[]) {
    if (!card || !indexes.length) return
    const current = session?.id === card.id ? session.shown : []
    const next = current.slice()
    for (const index of indexes) {
      if (!next.includes(index)) next.push(index)
    }
    if (next.length === current.length) return
    setSession({
      id: card.id,
      step: 'fade',
      help: learning ? help : raise(help, 2),
      shown: next,
    })
  }

  function releaseCard(id: string) {
    releaseMemory(id)
    if (getVoice().scriptKey === `memory:${id}`) stopVoice()
    if (result?.card.id === id || session?.id === id) {
      sealed.current = false
      setRehearse(false)
      setResult(null)
      setSession(null)
    }
  }

  function bumpHelp(level: Help) {
    if (!card || learning) return
    setSession({ id: card.id, step, help: raise(help, level), shown })
  }

  function finish(accuracy: number, forced?: number) {
    if (!card || sealed.current) return
    sealed.current = true
    const safe = Number.isFinite(accuracy) ? Math.max(0, Math.min(1, accuracy)) : 0
    const raw = gradeFromAccuracy(safe)
    let grade = forced ?? raw
    const used = helpRef.current
    if (!learning && forced == null) {
      if (used >= 2) grade = Math.min(grade, 3)
      else if (used >= 1) grade = Math.min(grade, 4)
    }
    const before = memoryStrength(card)
    if (!rehearseRef.current) reviewMemory(card.id, grade, safe)
    setSeen(card.id)
    if (getVoice().scriptKey === `memory:${card.id}`) stopVoice()
    setResult({
      card,
      accuracy: safe,
      grade,
      before,
      capped: !learning && forced == null && grade < raw,
      rehearsed: rehearseRef.current,
    })
  }

  function openCard(id: string) {
    if (id === card?.id && !result) return
    const item = state.deck.find((entry) => entry.id === id)
    if (!item) return
    sealed.current = false
    setRehearse(false)
    if (id !== seen) setSeen(null)
    setResult(null)
    setMark({ cursor: 0, total: versePieces(item.text).filter((piece) => piece.kind === 'word').length })
    setSession({
      id,
      step: isLearning(item) ? 'read' : 'write',
      help: seen === id && !isLearning(item) ? 2 : 0,
      shown: [],
    })
  }

  function hear(item: MemoryCard) {
    const key = `memory:${item.id}`
    const snap = getVoice()
    if (snap.scriptKey === key && snap.status === 'playing') {
      pauseVoice()
      return
    }
    if (snap.scriptKey === key && snap.status === 'paused') {
      resumeVoice()
      return
    }
    void startScript({
      key,
      title: item.label,
      lines: [{ key, label: item.label, text: item.text, href: '/memorize' }],
      translation: item.translation,
    })
  }

  if (result) {
    const saved = state.deck.find((item) => item.id === result.card.id)
    const after = saved ? memoryStrength(saved) : result.before
    const stillDue = due.some((item) => item.id === result.card.id)
    const nextCard = due.find((item) => item.id !== result.card.id)
    const dueAt = saved?.due ?? result.card.due
    let schedule = ''
    if (result.rehearsed) {
      schedule = dueAt <= Date.now() ? 'Rehearsed. It is still waiting.' : `Rehearsed. It still returns ${longDate(dueAt)}.`
    } else if (result.grade < 3) {
      schedule = 'It stays here until it holds.'
    } else {
      schedule = `Kept. It returns ${longDate(dueAt)}.`
    }
    const beforeName = strengthLabel(result.before)
    const afterName = strengthLabel(after)
    return (
      <div className="reading memory">
        <section className="memory-plate">
        <div className="memory-head">
          <p className="kicker">{[afterName, translationShort(result.card.translation)].join(' · ')}</p>
          <h1>{result.card.label}</h1>
          <Ring value={after} />
        </div>
        <p className="score memory-score">{Math.round(result.accuracy * 100)}%</p>
        <p className="lede">{verdict(result.grade)}</p>
        <p className="quiet memory-schedule">{schedule}</p>
        {!result.rehearsed && beforeName !== afterName ? <p className="quiet">{beforeName} becomes {afterName}.</p> : null}
        {result.capped ? <p className="quiet">A hint was used, so it returns sooner.</p> : null}
        {!stillDue && nextCard ? <p className="quiet">Next is {nextCard.label}.</p> : null}
        <div className="memory-stage memory-stage-result">
          <p className="vt memory-rise">
            {versePieces(result.card.text).map((piece, index) => {
              const marked = voice.scriptKey === `memory:${result.card.id}` && voice.status !== 'idle' && piece.kind === 'word' && piece.index === wordIndexAt(result.card.text, voice.charIndex)
              return piece.kind === 'gap' ? (
                <span key={index}>{piece.text}</span>
              ) : (
                <span key={index} className={marked ? 'mem-word spoken' : 'mem-word'} style={{ animationDelay: `${piece.index * 26}ms` }}>{piece.text}</span>
              )
            })}
          </p>
          {result.card.translation === 'esv' ? <EsvNotice /> : null}
          {result.card.translation === 'niv' ? <NivNotice /> : null}
        </div>
        <div className="row memory-actions">
          {voice.supported ? (
            <button type="button" className="choice" onClick={() => hear(result.card)}>
              {voice.scriptKey === `memory:${result.card.id}` && voice.status === 'playing' ? 'Pause' : voice.scriptKey === `memory:${result.card.id}` && voice.status === 'paused' ? 'Resume' : 'Hear it'}
            </button>
          ) : null}
          <button
            type="button"
            className="choice gold"
            onClick={() => {
              sealed.current = false
              setRehearse(false)
              setSeen(result.card.id)
              setResult(null)
              setSession(null)
            }}
          >
            Continue
          </button>
          <button
            type="button"
            className="choice"
            onClick={() => {
              sealed.current = false
              setRehearse(true)
              setSeen(result.card.id)
              setResult(null)
              setMark({ cursor: 0, total: versePieces(result.card.text).filter((piece) => piece.kind === 'word').length })
              setSession({
                id: result.card.id,
                step: 'write',
                help: isLearning(result.card) ? 0 : 2,
                shown: [],
              })
            }}
          >
            Once more
          </button>
        </div>
        </section>
        <Deck deck={state.deck} active={result.card.id} onOpen={openCard} onRelease={releaseCard} />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="reading memory">
        <section className="memory-plate">
          <p className="kicker">Memory</p>
          <h1>Nothing is waiting</h1>
          <p className="lede">
            {state.deck.length
              ? 'What you have set is resting. Rehearse a verse below, or open a chapter and set another.'
              : 'Open a verse and set it in memory. It will return here when it is time.'}
          </p>
          {!state.deck.length ? (
            <button type="button" className="choice gold" onClick={() => go('/')}>Open the Scriptures</button>
          ) : null}
        </section>
        <Deck deck={state.deck} active="" onOpen={openCard} onRelease={releaseCard} />
      </div>
    )
  }

  const memoryKey = `memory:${card.id}`
  const spoken = voice.scriptKey === memoryKey && voice.status !== 'idle' ? wordIndexAt(card.text, voice.charIndex) : null
  const hearLabel = voice.scriptKey === memoryKey && voice.status === 'playing' ? 'Pause' : voice.scriptKey === memoryKey && voice.status === 'paused' ? 'Resume' : 'Hear it'
  const dueIndex = due.findIndex((item) => item.id === card.id)
  const place = onQueue && dueIndex >= 0 ? `${dueIndex + 1} of ${due.length}` : rehearse ? 'Once more' : 'Rehearsal'
  const kicker = [strengthLabel(strength), translationShort(card.translation), place]
  if (streak === 1) kicker.push('1-day streak')
  else if (streak > 1) kicker.push(`${streak}-day streak`)

  const recalled = fadePhrases.filter((run) => phraseWordIndexes(run).every((index) => shown.includes(index))).length
  const phraseCount = fadePhrases.length
  const progress = step === 'fade' ? (veiled ? recalled / Math.max(phraseCount, 1) : 1) : wordCount ? mark.cursor / wordCount : 0
  const meter = step === 'fade'
    ? veiled ? `${recalled} of ${phraseCount} recalled` : 'In view'
    : step === 'letters' || step === 'write'
      ? `${mark.cursor} of ${wordCount}`
      : ''
  const note = step === 'read'
    ? learning ? 'Read it once, slowly.' : 'The words, if you need them.'
    : step === 'fade'
      ? veiled ? 'Touch a clause to call it back.' : 'Watch them fall away.'
      : step === 'letters'
        ? 'The first letters remain. Write each word, then a space.'
        : learning ? 'Write it from memory.' : 'The shape remains. Write the words.'

  return (
    <div className="reading memory">
      <section className="memory-plate">
      <div className="memory-head">
        <p className="kicker">{kicker.join(' · ')}</p>
        <h1>{card.label}</h1>
        <Ring value={strength} />
      </div>
      <div className="memory-steps" role="tablist" aria-label="Drill">
        {STEPS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={step === item.id}
            className={step === item.id ? 'on' : ''}
            onClick={() => goStep(item.id)}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="memory-stage">
        {step === 'read' ? (
          <p className="vt memory-line">
            {pieces.map((piece, index) =>
              piece.kind === 'gap' ? (
                <span key={index}>{piece.text}</span>
              ) : (
                <span key={index} className={spoken === piece.index ? 'mem-word spoken' : 'mem-word'}>{piece.text}</span>
              ),
            )}
          </p>
        ) : null}
        {step === 'fade' ? (
          <p className={veiled ? 'vt memory-line is-veiled' : 'vt memory-line'}>
            {runs.map((run, runIndex) => {
              const indexes = phraseWordIndexes(run)
              if (!indexes.length) {
                return run.nodes.map((piece, index) => <span key={`gap-${runIndex}-${index}`}>{piece.text}</span>)
              }
              return (
                <FadePhrase
                  key={run.phrase}
                  run={run}
                  open={!veiled || indexes.every((index) => shown.includes(index))}
                  veiled={veiled}
                  spoken={spoken}
                  onReveal={() => revealPhrase(indexes)}
                />
              )
            })}
          </p>
        ) : null}
        {step === 'letters' || step === 'write' ? (
          <Recitation
            key={`${card.id}:${step}`}
            ref={recite}
            pieces={pieces}
            coach={step === 'letters' ? 'letters' : 'blank'}
            onProgress={(cursor) => setMark({ cursor, total: wordCount })}
            onDone={(accuracy) => {
              if (step === 'letters') goStep('write')
              else finish(accuracy)
            }}
          />
        ) : null}
        {meter ? (
          <div className="memory-meter">
            <span className="hair" style={cssVars({ '--p': progress })}><i /></span>
            <span className="quiet">{meter}</span>
          </div>
        ) : null}
        <p className="memory-note">{note}</p>
        {card.translation === 'esv' ? <EsvNotice /> : null}
        {card.translation === 'niv' ? <NivNotice /> : null}
      </div>
      <div className="row memory-actions">
        {step === 'read' ? (
          <>
            <button type="button" className="choice gold" onClick={() => goStep('fade')}>Hide the words</button>
            {voice.supported ? (
              <button type="button" className="choice" onClick={() => hear(card)}>{hearLabel}</button>
            ) : null}
          </>
        ) : null}
        {step === 'fade' ? (
          <>
            <button
              type="button"
              className="choice"
              disabled={recalled >= phraseCount}
              onClick={() => {
                const next = fadePhrases.find((run) => phraseWordIndexes(run).some((index) => !shown.includes(index)))
                if (next) revealPhrase(phraseWordIndexes(next))
              }}
            >
              Show one
            </button>
            <button
              type="button"
              className="choice"
              onClick={() => {
                if (!card) return
                setSession({ id: card.id, step: 'fade', help, shown: [] })
                setVeilRun((run) => run + 1)
              }}
            >
              Veil again
            </button>
            <button type="button" className="choice gold" onClick={() => goStep('letters')}>First letters</button>
          </>
        ) : null}
        {step === 'letters' ? (
          <>
            <button
              type="button"
              className="choice"
              onClick={() => {
                bumpHelp(2)
                recite.current?.revealCurrent()
              }}
            >
              Show this word
            </button>
            <button type="button" className="choice gold" onClick={() => goStep('write')}>Write it</button>
          </>
        ) : null}
        {step === 'write' ? (
          <>
            {mark.cursor > 0 ? (
              <button type="button" className="choice gold" onClick={() => finish(recite.current?.accuracy() ?? 0)}>
                Score this
              </button>
            ) : null}
            <button
              type="button"
              className="choice"
              onClick={() => {
                bumpHelp(2)
                recite.current?.revealCurrent()
              }}
            >
              Show this word
            </button>
            <button type="button" className="choice" onClick={() => finish(recite.current?.accuracy() ?? 0, 1)}>I missed it</button>
          </>
        ) : null}
      </div>
      </section>
      <Deck deck={state.deck} active={card.id} onOpen={openCard} onRelease={releaseCard} />
    </div>
  )
}

function FadePhrase({ run, open, veiled, spoken, onReveal }: { run: PhraseRun; open: boolean; veiled: boolean; spoken: number | null; onReveal: () => void }) {
  const hidden = veiled && !open
  return (
    <button
      type="button"
      className={open && veiled ? 'mem-fade open' : 'mem-fade'}
      style={cssVars({ '--i': run.phrase })}
      onClick={() => {
        if (veiled && !open) onReveal()
      }}
      aria-label={hidden ? 'Hidden clause' : undefined}
    >
      {run.nodes.map((piece, index) =>
        piece.kind === 'gap' ? (
          <span key={index} aria-hidden={hidden ? true : undefined}>{piece.text}</span>
        ) : (
          <span key={index} className={spoken === piece.index ? 'mem-word spoken' : 'mem-word'} aria-hidden={hidden ? true : undefined}>{piece.text}</span>
        ),
      )}
    </button>
  )
}

const Recitation = forwardRef<ReciteHandle, {
  pieces: VersePiece[]
  coach: 'letters' | 'blank'
  onProgress: (cursor: number) => void
  onDone: (accuracy: number) => void
}>(function Recitation({ pieces, coach, onProgress, onDone }, ref) {
  const words = useMemo(() => pieces.filter((piece) => piece.kind === 'word'), [pieces])
  const [cursor, setCursor] = useState(0)
  const [draft, setDraft] = useState('')
  const [locked, setLocked] = useState<Lock[]>(() => words.map(() => null))
  const [bloom, setBloom] = useState<number | null>(null)
  const [shake, setShake] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const onDoneRef = useRef(onDone)
  const onProgressRef = useRef(onProgress)
  onDoneRef.current = onDone
  onProgressRef.current = onProgress

  useEffect(() => {
    onProgressRef.current(cursor)
  }, [cursor])

  useEffect(() => {
    if (!words.length || cursor < words.length) return
    const accuracy = locked.filter((item) => item === 'ok').length / words.length
    const id = window.setTimeout(() => onDoneRef.current(accuracy), 560)
    return () => window.clearTimeout(id)
  }, [cursor, locked, words.length])

  function accuracyNow(): number {
    if (!words.length) return 0
    let hits = locked.filter((item) => item === 'ok').length
    const word = words[cursor]
    if (word && sameWord(word.text, draft)) hits += 1
    return hits / words.length
  }

  function lock(kind: 'ok' | 'hint') {
    if (cursor >= words.length) return
    setLocked((list) => {
      const next = list.slice()
      next[cursor] = kind
      return next
    })
    setBloom(cursor)
    setDraft('')
    setShake(false)
    setCursor((value) => value + 1)
  }

  function tryLock(raw: string) {
    const word = words[cursor]
    if (!word) return
    if (sameWord(word.text, raw)) {
      lock('ok')
      return
    }
    if (raw.trim()) setShake(true)
  }

  useImperativeHandle(ref, () => ({
    revealCurrent() {
      lock('hint')
    },
    accuracy: accuracyNow,
    cursor: () => cursor,
  }), [cursor, draft, locked, words])

  if (!words.length) return null

  return (
    <p
      className="vt memory-line"
      onMouseDown={(event) => {
        if (event.target === input.current) return
        event.preventDefault()
        input.current?.focus()
      }}
    >
      {pieces.map((piece, index) => {
        if (piece.kind === 'gap') return <span key={index}>{piece.text}</span>
        const state = locked[piece.index]
        if (state === 'ok' || state === 'hint') {
          const klass = ['mem-word', bloom === piece.index ? 'seal' : '', state === 'hint' ? 'hinted' : ''].filter(Boolean).join(' ')
          return (
            <span key={index} className={klass} onAnimationEnd={() => setBloom((value) => (value === piece.index ? null : value))}>
              {piece.text}
            </span>
          )
        }
        if (piece.index === cursor) {
          const wide = Math.max(piece.text.length, draft.length, 1)
          const off = draft.trim().length > 0 && !wordPrefix(piece.text, draft)
          const slotClass = ['memory-slot', off ? 'bad' : '', shake ? 'shake' : ''].filter(Boolean).join(' ')
          return (
            <span key={index} className={slotClass} style={cssVars({ '--w': `${wide}ch` })} onAnimationEnd={() => setShake(false)}>
              {coach === 'letters' && draft.length === 0 ? (
                <span className="memory-ghost" aria-hidden="true">{scaffold(piece.text)}</span>
              ) : null}
              <input
                ref={input}
                value={draft}
                autoFocus
                maxLength={48}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                aria-label={`Word ${cursor + 1} of ${words.length}`}
                onChange={(event) => {
                  const value = event.target.value
                  if (/\s/.test(value)) {
                    tryLock(value)
                    return
                  }
                  setDraft(value)
                  if (wordPrefix(piece.text, value)) setShake(false)
                  if (sameWord(piece.text, value)) lock('ok')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (draft.trim()) tryLock(draft)
                    return
                  }
                  if (event.key === 'Backspace' && draft === '' && cursor > 0) {
                    event.preventDefault()
                    const prev = cursor - 1
                    setCursor(prev)
                    setLocked((list) => {
                      const next = list.slice()
                      next[prev] = null
                      return next
                    })
                    setBloom(null)
                  }
                }}
              />
            </span>
          )
        }
        if (coach === 'letters') {
          return <span key={index} className="mem-ghost-word">{scaffold(piece.text)}</span>
        }
        return <span key={index} className="mem-rule" style={cssVars({ '--w': `${piece.text.length}ch` })} aria-hidden="true" />
      })}
    </p>
  )
})

function scaffold(text: string): string {
  return `${text[0] ?? ''}${'·'.repeat(Math.max(0, text.length - 1))}`
}

function Ring({ value }: { value: number }) {
  const [draw, setDraw] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setDraw(value)
      return
    }
    setDraw(0)
    const id = requestAnimationFrame(() => setDraw(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  const radius = 28
  const turn = 2 * Math.PI * radius
  const dash = Math.max(0, Math.min(1, draw)) * turn
  const label = strengthLabel(value)
  return (
    <div className="memory-strength" role="img" aria-label={`${label}, ${Math.round(value * 100)} percent`}>
      <svg className="memory-ring" viewBox="0 0 72 72" aria-hidden="true">
        <circle className="ring-track" cx="36" cy="36" r={radius} />
        {dash > 0 ? <circle className="ring-value" cx="36" cy="36" r={radius} strokeDasharray={`${dash} ${turn}`} /> : null}
      </svg>
      <span className="memory-ring-num">{Math.round(value * 100)}</span>
    </div>
  )
}

function Deck({ deck, active, onOpen, onRelease }: { deck: MemoryCard[]; active: string; onOpen: (id: string) => void; onRelease: (id: string) => void }) {
  if (!deck.length) return null
  const now = Date.now()
  const ordered = deck.slice().sort((a, b) => a.due - b.due)
  const waiting = ordered.filter((card) => card.due <= now)
  const resting = ordered.filter((card) => card.due > now)
  return (
    <section className="memory-deck">
      {waiting.length ? <DeckGroup title="Due" cards={waiting} active={active} onOpen={onOpen} onRelease={onRelease} /> : null}
      {resting.length ? <DeckGroup title="Resting" cards={resting} active={active} onOpen={onOpen} onRelease={onRelease} /> : null}
    </section>
  )
}

function DeckGroup({ title, cards, active, onOpen, onRelease }: { title: string; cards: MemoryCard[]; active: string; onOpen: (id: string) => void; onRelease: (id: string) => void }) {
  return (
    <div className="memory-group">
      <h2>{title}</h2>
      {cards.map((card) => {
        const when = whenDue(card.due)
        const strength = memoryStrength(card)
        const percent = card.accuracy == null ? '' : `${Math.round(card.accuracy * 100)}%`
        return (
          <div key={card.id} className={card.id === active ? 'memory-row on' : 'memory-row'}>
            <button type="button" className="memory-row-open" onClick={() => onOpen(card.id)}>
              <strong>{card.label}</strong>
              <span className="quiet memory-meta">
                {translationShort(card.translation)} · {strengthLabel(strength)}
                {percent ? ` · ${percent}` : ''}
              </span>
            </button>
            <span className={when.dueNow ? 'memory-when memory-due' : 'memory-when'}>{when.label}</span>
            <button type="button" className="memory-release" onClick={() => onRelease(card.id)}>Release</button>
            <span className="hair" style={cssVars({ '--p': strength })}><i /></span>
          </div>
        )
      })}
    </div>
  )
}
