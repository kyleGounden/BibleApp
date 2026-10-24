import { useEffect, useState } from 'react'
import { formatRef, parseRef } from '../lib/canon'
import { searchCanon, translationShort } from '../lib/bible'
import { EsvError, useEsvToken } from '../lib/esv'
import { go, type Route } from '../lib/router'
import { useVoice, type ScriptLine } from '../lib/speech'
import { useAppState } from '../lib/storage'
import { EsvNotice, GodLine, ListenButton, verseMark } from '../ui'

function hitLine(hit: { id: string; text: string }): ScriptLine {
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

export function SearchPage({ route }: { route: Extract<Route, { name: 'search' }> }) {
  const state = useAppState()
  const voice = useVoice()
  const esvToken = useEsvToken()
  const [hits, setHits] = useState<{ id: string; text: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    const q = route.q.trim()
    if (q.length < 2) {
      setHits([])
      setNote('Enter at least two letters.')
      return
    }
    let live = true
    setBusy(true)
    setNote('Reading the canon…')
    searchCanon(state.translation, q)
      .then((rows) => {
        if (!live) return
        setHits(rows)
        const cap = state.translation === 'esv' ? 40 : 60
        setNote(rows.length >= cap ? `${cap === 40 ? 'Forty' : 'Sixty'} places shown. Add another word to narrow them.` : `${rows.length} places`)
        setBusy(false)
      })
      .catch((err: unknown) => {
        if (!live) return
        setBusy(false)
        setHits([])
        setNote(err instanceof EsvError ? err.message : 'The text is not on the device yet.')
      })
    return () => {
      live = false
    }
  }, [route.q, state.translation, esvToken])

  return (
    <div>
      <p className="kicker">Search · {translationShort(state.translation)}</p>
      <h1>{route.q || 'Search'}</h1>
      <p className="quiet">{busy ? 'Reading the canon…' : note}</p>
      {hits.length ? (
        <ListenButton
          scriptKey={`search:${state.translation}:${route.q}`}
          title={route.q || 'Search'}
          label="Read all"
          className="choice"
          translation={state.translation}
          lines={hits.map(hitLine)}
        />
      ) : null}
      {state.translation === 'esv' && hits.length ? <EsvNotice /> : null}
      {hits.map((hit) => {
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
              <span className="vt"><GodLine translation={state.translation} id={hit.id} text={hit.text} mark={mark} /></span>
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
