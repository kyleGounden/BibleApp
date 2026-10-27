import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { bookById, formatRef, parseRef, parseSpokenRef, type Testament } from '../lib/canon'
import { searchCanonStream, translationShort, type SearchHit } from '../lib/bible'
import { EsvError, useEsvToken } from '../lib/esv'
import { NivError } from '../lib/niv'
import { go, type Route } from '../lib/router'
import { useVoice, type ScriptLine } from '../lib/speech'
import { setTranslation, useAppState } from '../lib/storage'
import { EsvNotice, GodLine, ListenButton, NivNotice, verseMark } from '../ui'

const RECENT_KEY = 'scripture.search.recent'
const RECENT_CAP = 8

type Scope = 'all' | Testament

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length >= 2).slice(0, RECENT_CAP)
  } catch {
    return []
  }
}

function pushRecent(query: string): string[] {
  const next = [query, ...loadRecent().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, RECENT_CAP)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
  return next
}

function hitLine(hit: SearchHit): ScriptLine {
  const parsed = parseRef(hit.id)
  return {
    key: hit.id,
    label: formatRef(hit.id),
    text: hit.text,
    book: parsed?.book,
    chapter: parsed?.chapter,
    verse: parsed?.verse,
    href: parsed ? `/read/${parsed.book}/${parsed.chapter}/${parsed.verse}` : undefined,
  }
}

function MatchText({ text, query }: { text: string; query: string }): ReactNode {
  const needle = query.trim()
  if (needle.length < 2) return text
  const hay = text.toLowerCase()
  const fold = needle.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  let key = 0
  while (from < text.length) {
    const at = hay.indexOf(fold, from)
    if (at < 0) {
      parts.push(text.slice(from))
      break
    }
    if (at > from) parts.push(text.slice(from, at))
    parts.push(
      <mark key={key} className="hit-mark">
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    key += 1
    from = at + needle.length
  }
  return parts
}

function inScope(id: string, scope: Scope): boolean {
  if (scope === 'all') return true
  const parsed = parseRef(id)
  if (!parsed) return true
  return bookById(parsed.book)?.testament === scope
}

export function SearchPage({ route }: { route: Extract<Route, { name: 'search' }> }) {
  const state = useAppState()
  const voice = useVoice()
  const esvToken = useEsvToken()
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [scanned, setScanned] = useState(0)
  const [total, setTotal] = useState(0)
  const [note, setNote] = useState('')
  const [fail, setFail] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [recent, setRecent] = useState(loadRecent)
  const spoken = useMemo(() => parseSpokenRef(route.q), [route.q])

  useEffect(() => {
    const q = route.q.trim()
    if (q.length < 2) {
      setHits([])
      setBusy(false)
      setDone(true)
      setFail('')
      setNote('Enter at least two letters.')
      return
    }
    setRecent(pushRecent(q))
    let live = true
    const control = new AbortController()
    setBusy(true)
    setDone(false)
    setFail('')
    setHits([])
    setScanned(0)
    setTotal(0)
    setNote('Searching…')

    void searchCanonStream(
      state.translation,
      q,
      (next) => {
        if (!live) return
        setHits(next.hits)
        setScanned(next.scanned)
        setTotal(next.total)
        setDone(next.done)
        if (!next.done) {
          setNote(next.hits.length ? `Found ${next.hits.length}…` : `Reading books ${next.scanned} of ${next.total}…`)
          return
        }
        setBusy(false)
        const cap = state.translation === 'esv' || state.translation === 'niv' ? 40 : 60
        if (!next.hits.length) {
          setNote('No places found.')
          return
        }
        setNote(
          next.hits.length >= cap
            ? `${cap === 40 ? 'Forty' : 'Sixty'} places shown. Add another word to narrow them.`
            : `${next.hits.length} places`,
        )
      },
      control.signal,
    ).catch((err: unknown) => {
      if (!live) return
      setBusy(false)
      setDone(true)
      setHits([])
      const message = err instanceof EsvError || err instanceof NivError ? err.message : 'The text is not on the device yet.'
      setFail(message)
      setNote('')
    })

    return () => {
      live = false
      control.abort()
    }
  }, [route.q, state.translation, esvToken])

  const visible = useMemo(() => hits.filter((hit) => inScope(hit.id, scope)), [hits, scope])
  const q = route.q.trim()

  return (
    <div>
      <p className="kicker">Search · {translationShort(state.translation)}</p>
      <h1>{q || 'Search'}</h1>
      {spoken ? (
        <section className="panel search-ref" aria-label="Verse reference">
          <p className="kicker">Reference</p>
          <h2>{formatRef(`${spoken.book}.${spoken.chapter}.${spoken.verse}${spoken.end > spoken.verse ? `-${spoken.end}` : ''}`)}</h2>
          <button
            type="button"
            className="choice gold"
            onClick={() => go(`/read/${spoken.book}/${spoken.chapter}/${spoken.verse}`)}
          >
            Open {formatRef(`${spoken.book}.${spoken.chapter}.${spoken.verse}`)}
          </button>
        </section>
      ) : null}
      <div className="filters" role="group" aria-label="Testament">
        {([
          ['all', 'All'],
          ['OT', 'Old'],
          ['NT', 'New'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={scope === id ? 'on' : ''} onClick={() => setScope(id)}>
            {label}
          </button>
        ))}
      </div>
      {recent.length && q.length < 2 ? (
        <div className="chips" aria-label="Recent searches">
          {recent.map((item) => (
            <button key={item} type="button" className="chip" onClick={() => go(`/search/${encodeURIComponent(item)}`)}>
              {item}
            </button>
          ))}
        </div>
      ) : null}
      {recent.length && q.length >= 2 ? (
        <div className="chips search-recent" aria-label="Recent searches">
          {recent.slice(0, 5).map((item) => (
            <button key={item} type="button" className={item === q ? 'chip on' : 'chip'} onClick={() => go(`/search/${encodeURIComponent(item)}`)}>
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <p className="quiet" aria-live="polite">
        {busy && !done ? note : note}
        {busy && total > 0 && !done ? ` · ${scanned}/${total}` : ''}
      </p>
      {fail ? (
        <div className="panel search-fail" role="alert">
          <p className="miss">{fail}</p>
          {(state.translation === 'niv' || state.translation === 'esv') ? (
            <p className="quiet">
              Try the offline text:{' '}
              <button type="button" className="text-btn" onClick={() => setTranslation('web')}>WEB</button>
              {' · '}
              <button type="button" className="text-btn" onClick={() => setTranslation('kjv')}>KJV</button>
            </p>
          ) : null}
        </div>
      ) : null}
      {visible.length ? (
        <ListenButton
          scriptKey={`search:${state.translation}:${q}:${scope}`}
          title={q || 'Search'}
          label="Read all"
          className="choice"
          translation={state.translation}
          lines={visible.map(hitLine)}
        />
      ) : null}
      {state.translation === 'esv' && visible.length ? <EsvNotice /> : null}
      {state.translation === 'niv' && visible.length ? <NivNotice /> : null}
      {!busy && done && !fail && q.length >= 2 && !visible.length ? (
        <p className="quiet">
          Nothing in the {scope === 'all' ? 'canon' : scope === 'OT' ? 'Old Testament' : 'New Testament'} matched.
          {(state.translation === 'niv' || state.translation === 'esv') ? (
            <>
              {' '}You can also search{' '}
              <button type="button" className="text-btn" onClick={() => setTranslation('web')}>WEB</button>
              {' '}or{' '}
              <button type="button" className="text-btn" onClick={() => setTranslation('kjv')}>KJV</button>
              {' '}offline.
            </>
          ) : null}
        </p>
      ) : null}
      {visible.map((hit) => {
        const parsed = parseRef(hit.id)
        const mark = verseMark(voice, hit.id, state.translation)
        return (
          <article key={hit.id} className={mark != null ? 'hit speaking' : 'hit'}>
            <button
              type="button"
              className="list-btn"
              onClick={() => parsed && go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)}
            >
              <strong>{formatRef(hit.id)}</strong>
              <span className="vt">
                {mark != null ? (
                  <GodLine translation={state.translation} id={hit.id} text={hit.text} mark={mark} />
                ) : (
                  <MatchText text={hit.text} query={q} />
                )}
              </span>
            </button>
            <ListenButton
              scriptKey={`hit:${state.translation}:${hit.id}`}
              title={formatRef(hit.id)}
              translation={state.translation}
              lines={[hitLine(hit)]}
            />
          </article>
        )
      })}
    </div>
  )
}
