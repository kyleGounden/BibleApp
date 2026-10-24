import { useEffect, useState } from 'react'
import { BOOKS, CIRCUIT, bookName, formatRef, parseRef, verseId } from '../lib/canon'
import { bookGuide, useGuides } from '../lib/guide'
import { loadChapter, loadXrefs, plain } from '../lib/bible'
import { EsvError, useEsvToken } from '../lib/esv'
import { loadTrails, type Trail } from '../lib/catalog'
import { go } from '../lib/router'
import { addMemory, continueCircuit, inkHex, isChapterRead, markChapterRead, resetCircuit, useAppState } from '../lib/storage'
import { EsvNotice, GodLine } from '../ui'

export function CanonPage() {
  const state = useAppState()
  const guides = useGuides()
  const esvToken = useEsvToken()
  const place = CIRCUIT[state.circuit]
  const [memoryId, setMemoryId] = useState('')
  const [memoryText, setMemoryText] = useState('')
  const [trails, setTrails] = useState<Trail[]>([])
  const [memoryNote, setMemoryNote] = useState('')
  const readTotal = BOOKS.reduce((sum, book) => sum + (state.read[book.id] ?? []).length, 0)

  useEffect(() => {
    let live = true
    loadTrails().then((next) => live && setTrails(next)).catch(() => live && setTrails([]))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!place) return
    let live = true
    setMemoryNote('')
    Promise.all([loadChapter(state.translation, place.book, place.chapter), loadXrefs(place.book)]).then(([book, refs]) => {
      if (!live) return
      const verses = book.chapters[String(place.chapter)] ?? {}
      let best = 1
      let bestCount = -1
      for (const key of Object.keys(verses)) {
        const count = (refs[`${place.chapter}:${key}`] ?? []).reduce((sum, group) => sum + group.v.length, 0)
        if (count > bestCount) {
          bestCount = count
          best = Number(key)
        }
      }
      const text = plain(verses[String(best)])
      setMemoryId(verseId(place.book, place.chapter, best))
      setMemoryText(text)
    }).catch((err: unknown) => {
      if (!live) return
      setMemoryId(verseId(place.book, place.chapter, 1))
      setMemoryText('')
      if (state.translation === 'esv') setMemoryNote(err instanceof EsvError ? err.message : 'The ESV text did not load.')
    })
    return () => {
      live = false
    }
  }, [place, state.translation, esvToken])

  return (
    <div>
      <p className="kicker">Canon</p>
      <h1>The books, as you read them</h1>
      <p className="lede">{readTotal} of {CIRCUIT.length} chapters marked read.</p>
      <section className="panel">
        {place ? (
          <>
            <p className="kicker">Today’s reading · {state.circuit + 1} of {CIRCUIT.length}</p>
            <h2>{bookName(place.book)} {place.chapter}</h2>
            {memoryId ? <p className="quiet">Verse to keep: {formatRef(memoryId)}</p> : null}
            {memoryText && memoryId ? <p className="vt"><GodLine translation={state.translation} id={memoryId} text={memoryText} mark={null} /></p> : null}
            {state.translation === 'esv' && memoryText ? <EsvNotice /> : null}
            {memoryNote ? <p className="miss">{memoryNote}</p> : null}
            <div className="row">
              <button type="button" className="choice gold" onClick={() => go(`/read/${place.book}/${place.chapter}`)}>Open the chapter</button>
              <button type="button" className="choice" onClick={() => memoryId && go(`/refs/${memoryId}`)}>Its links</button>
              <button
                type="button"
                className="choice"
                onClick={() => {
                  if (!memoryId || !memoryText) return
                  if (!addMemory(state.translation, [memoryId], memoryText)) {
                    setMemoryNote('Saved ESV text stays within 500 verses, the limit Crossway sets for a copy kept on this device.')
                    return
                  }
                  go('/memorize')
                }}
              >
                Memorize the verse
              </button>
              <button
                type="button"
                className="choice"
                onClick={() => {
                  if (isChapterRead(place.book, place.chapter)) continueCircuit()
                  else markChapterRead(place.book, place.chapter)
                }}
              >
                {isChapterRead(place.book, place.chapter) ? 'Continue' : 'Mark read and continue'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>The circuit is complete</h2>
            <button type="button" className="choice" onClick={resetCircuit}>Begin again at Genesis</button>
          </>
        )}
      </section>
      <section style={{ marginTop: '1.4rem' }}>
        <h2>Trails</h2>
        <div className="chips">
          {trails.map((trail) => (
            <button key={trail.id} type="button" className="chip" onClick={() => go(`/trail/${trail.id}`)}>{trail.title}</button>
          ))}
        </div>
      </section>
      <section style={{ marginTop: '1.4rem' }}>
        <h2>Atlas</h2>
        <p className="quiet">Biblical places, marked on a map.</p>
        <button type="button" className="choice" onClick={() => go('/places')}>Open the atlas</button>
      </section>
      {Object.keys(state.highlights).length ? (
        <section>
          <h2>Highlighted</h2>
          {Object.entries(state.highlights).map(([id, inkId]) => {
            const ink = state.palette.find((item) => item.id === inkId)
            const hex = ink ? inkHex(ink.color) : null
            return (
              <button key={id} type="button" className="list-btn" onClick={() => {
                const parsed = parseRef(id)
                if (parsed) go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)
              }}>
                <strong>{formatRef(id)}</strong>
                {hex ? (
                  <span className="ink-note">
                    <i className="dot" style={{ background: hex }} />
                    {ink?.label || null}
                  </span>
                ) : null}
              </button>
            )
          })}
        </section>
      ) : null}
      {state.marks.length ? (
        <section>
          <h2>Marked for study</h2>
          {state.marks.map((id) => (
            <button key={id} type="button" className="list-btn" onClick={() => {
              const parsed = parseRef(id)
              if (parsed) go(`/study/${parsed.book}/${parsed.chapter}/${parsed.verse}`)
            }}>
              <strong>{formatRef(id)}</strong>
              {state.notes[id] ? <span className="quiet">{state.notes[id]}</span> : null}
            </button>
          ))}
        </section>
      ) : null}
      <div className="canon-grid" style={{ marginTop: '1.2rem' }}>
        {BOOKS.map((book) => {
          const done = (state.read[book.id] ?? []).length
          return (
            <button key={book.id} type="button" className="canon-card" onClick={() => go(`/read/${book.id}/1`)}>
              <strong>{book.name}</strong>
              {guides ? <span className="book-line">{bookGuide(guides, book.id)?.line}</span> : null}
              <span className="quiet">{done}/{book.chapters}</span>
              <span className="bar"><i style={{ width: `${(done / book.chapters) * 100}%` }} /></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
