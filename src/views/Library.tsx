import { useEffect, useState } from 'react'
import { BOOKS, CIRCUIT, SHELVES, bookById, formatRef, parseRef, verseId } from '../lib/canon'
import { bookGuide, useGuides } from '../lib/guide'
import { loadChapter, plain, translationShort } from '../lib/bible'
import { useEsvToken } from '../lib/esv'
import { go } from '../lib/router'
import { useAppState } from '../lib/storage'
import { EsvNotice, GodLine, NivNotice } from '../ui'

export function Library() {
  const state = useAppState()
  const guides = useGuides()
  const esvToken = useEsvToken()
  const book = bookById(state.book)
  const shelfName = SHELVES.find((shelf) => shelf.books.includes(state.book))?.name ?? 'Canon'
  const [verseText, setVerseText] = useState('')
  const [verseIn, setVerseIn] = useState(false)
  const [openBook, setOpenBook] = useState<string | null>(null)
  const readCount = Object.values(state.read).reduce((sum, chapters) => sum + chapters.length, 0)
  const marks = [...state.marks].reverse().slice(0, 5)
  const firstRun = readCount === 0
  const featuredJourney = guides?.journeys[0]

  useEffect(() => {
    if (!book) return
    let live = true
    setVerseText('')
    setVerseIn(false)
    loadChapter(state.translation, book.id, state.chapter)
      .then((file) => {
        if (!live) return
        setVerseText(plain(file.chapters[String(state.chapter)]?.[String(state.verse)]) ?? '')
      })
      .catch(() => {
        if (live) setVerseText('')
      })
    return () => {
      live = false
    }
  }, [book, state.translation, state.chapter, state.verse, esvToken])

  useEffect(() => {
    if (!verseText) {
      setVerseIn(false)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setVerseIn(true)
      return
    }
    const frame = window.requestAnimationFrame(() => setVerseIn(true))
    return () => window.cancelAnimationFrame(frame)
  }, [verseText])

  function readBook(id: string) {
    if (id === state.book) go(`/read/${id}/${state.chapter}/${state.verse}`)
    else go(`/read/${id}/1`)
  }

  return (
    <div>
      <p className="kicker">The canon</p>
      <h1>The Scriptures</h1>
      <p className="lede">
        {firstRun
          ? 'Begin in the text, or walk the story of the King.'
          : 'Read a book, then follow its words into the rest of the canon.'}
      </p>
      <section className={firstRun ? 'opening opening-hero' : 'opening'} aria-label="Current place">
        <p className="kicker">{shelfName} · {translationShort(state.translation)}</p>
        <h2>{book?.name ?? state.book} {state.chapter}:{state.verse}</h2>
        {verseText ? (
          <p className={verseIn ? 'opening-verse is-in' : 'opening-verse'}>
            <GodLine translation={state.translation} id={verseId(state.book, state.chapter, state.verse)} text={verseText} mark={null} />
          </p>
        ) : null}
        <div className="canon-rail" role="img" aria-label={`${readCount} of ${CIRCUIT.length} chapters read`}>
          <i style={{ transform: `scaleX(${readCount / CIRCUIT.length})` }} />
        </div>
        <p className="quiet canon-count">{readCount} of {CIRCUIT.length} chapters read</p>
        <div className="row opening-cta">
          <button type="button" className="choice" onClick={() => go(`/read/${state.book}/${state.chapter}/${state.verse}`)}>
            Continue reading
          </button>
          <button type="button" className="choice gold" onClick={() => go('/king')}>
            Get to know the King
          </button>
        </div>
        <div className="opening-more">
          <button type="button" className="text-btn" onClick={() => go(`/study/${state.book}/${state.chapter}/${state.verse}`)}>
            Study this verse
          </button>
          <button type="button" className="text-btn" onClick={() => go('/about')}>
            Why this book
          </button>
          {featuredJourney ? (
            <button type="button" className="text-btn" onClick={() => go(`/journey/${featuredJourney.id}`)}>
              Walk a journey
            </button>
          ) : (
            <button type="button" className="text-btn" onClick={() => go('/places')}>
              Walk a journey
            </button>
          )}
        </div>
        {marks.length ? (
          <div className="chips" aria-label="Marked verses">
            {marks.map((id) => {
              const parsed = parseRef(id)
              if (!parsed) return null
              return (
                <button key={id} type="button" className="chip" onClick={() => go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)}>
                  {formatRef(id)}
                </button>
              )
            })}
          </div>
        ) : null}
      </section>
      {SHELVES.map((shelf) => {
        const opened = openBook && shelf.books.includes(openBook) ? openBook : null
        const openedBook = opened ? bookById(opened) : undefined
        return (
          <section className="shelf" key={shelf.name}>
            <h2>{shelf.name}</h2>
            <div className="book-grid">
              {shelf.books.map((id) => {
                const item = bookById(id)
                if (!item) return null
                const done = (state.read[id] ?? []).length
                const open = openBook === id
                const current = state.book === id
                const line = guides ? bookGuide(guides, id)?.line : undefined
                return (
                  <div key={id} className={['book-plate', current ? 'on' : '', open ? 'open' : ''].filter(Boolean).join(' ')}>
                    <button
                      type="button"
                      className="book-open"
                      aria-expanded={open}
                      onClick={() => {
                        if (open) readBook(id)
                        else setOpenBook(id)
                      }}
                    >
                      <strong>{item.name}</strong>
                      {line ? <span className="book-line">{line}</span> : null}
                      <span className="hair" style={{ ['--p' as string]: done / item.chapters }}>
                        <i style={{ transform: `scaleX(${done / item.chapters})` }} />
                      </span>
                      <span className="book-meta">{done ? `${done}/${item.chapters}` : `${item.chapters} ch.`}</span>
                    </button>
                    {open ? (
                      <div className="row">
                        <button type="button" className="choice gold book-read" onClick={() => readBook(id)}>Read</button>
                        <button type="button" className="choice" onClick={() => go(`/book/${id}`)}>About</button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {opened && openedBook ? (
              <div className="mosaic" aria-label={`${openedBook.name} chapters`}>
                <div className="mosaic-cells">
                  {Array.from({ length: openedBook.chapters }, (_, index) => index + 1).map((chapter) => {
                    const read = (state.read[opened] ?? []).includes(chapter)
                    const here = state.book === opened && state.chapter === chapter
                    return (
                      <button
                        key={chapter}
                        type="button"
                        className={['cell', read ? 'read' : '', here ? 'here' : ''].filter(Boolean).join(' ')}
                        aria-current={here ? 'page' : undefined}
                        aria-label={`${openedBook.name} ${chapter}`}
                        onClick={() => go(`/read/${opened}/${chapter}`)}
                      >
                        {chapter}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </section>
        )
      })}
      <p className="colophon">
        King James Version. World English Bible. Cross-references from the Treasury of Scripture Knowledge.
        Strong’s numbers follow the King James text; the short gloss is Strong’s own brief line
        (Open Scriptures dictionary file, CC-BY-SA). {BOOKS.length} books. The verses stay the text.
        A setting above the chapter tells who wrote the book, who first heard it, and, where the story travels, the road.
        On a phone or computer, add Scripture to the home screen and it remains on the device.
        The Android and iOS projects use the same Capacitor shell.
      </p>
      <EsvNotice full />
      <NivNotice full />
    </div>
  )
}
