import { useEffect, useState } from 'react'
import { BOOKS, SHELVES, bookById, formatRef, parseRef, verseId } from '../lib/canon'
import { readVerse } from '../lib/bible'
import { go } from '../lib/router'
import { ListenButton, verseScripts } from '../ui'
import { RANKS, rankIndex, type RankName } from '../lib/school'
import {
  createFolio,
  deleteFolio,
  removeVerseFromFolio,
  renameFolio,
  useAppState,
  type Journal,
} from '../lib/storage'

const METHOD = [
  { n: '01', title: 'Read', line: 'Read the verse.', ink: 'ink-gold' },
  { n: '02', title: 'Words', line: 'Learn the words.', ink: 'ink-olive' },
  { n: '03', title: 'Links', line: 'Follow where Scripture speaks.', ink: 'ink-sky' },
  { n: '04', title: 'Notes', line: 'Write what you see.', ink: 'ink-violet' },
]

type WorkFilter = 'all' | 'marked' | 'highlighted' | 'notes' | RankName

const FILTERS: { id: WorkFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'marked', label: 'Marked' },
  { id: 'highlighted', label: 'Highlighted' },
  { id: 'notes', label: 'Notes' },
  ...RANKS.map((rank) => ({ id: rank.id, label: rank.label })),
]

const EMPTY: Record<WorkFilter, string> = {
  all: 'Open a verse, and your marks, notes, and ranks will wait here.',
  marked: 'Mark a verse while you study, and it will wait here.',
  highlighted: 'Highlight a verse while you study, and it will wait here.',
  notes: 'Write a note on a verse, and it will wait here.',
  novice: 'When you can name the original word, it will wait here.',
  reader: 'When you can read the form, it will wait here.',
  exegete: 'When you have compared the translations, it will wait here.',
  theologian: 'When you can place a verse in Scripture, it will wait here.',
}

function verseOrder(id: string): number {
  const parsed = parseRef(id)
  if (!parsed) return Number.MAX_SAFE_INTEGER
  const bookIndex = BOOKS.findIndex((book) => book.id === parsed.book)
  return (bookIndex < 0 ? 99 : bookIndex) * 100000 + parsed.chapter * 200 + parsed.verse
}

function studyPath(id: string): string | null {
  const parsed = parseRef(id)
  if (!parsed) return null
  return `/study/${parsed.book}/${parsed.chapter}/${parsed.verse}`
}

function previewLine(journal: Journal | undefined, note: string | undefined): string {
  const raw = journal?.see || journal?.original || journal?.canon || journal?.conclude || note || ''
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text.length <= 160) return text
  return `${text.slice(0, 157)}…`
}

function hasWriting(journal: Journal | undefined, note: string | undefined): boolean {
  return Boolean(note?.trim() || journal?.see?.trim() || journal?.original?.trim() || journal?.canon?.trim() || journal?.conclude?.trim())
}

export function StudyDesk() {
  const state = useAppState()
  const [title, setTitle] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingDelete, setPendingDelete] = useState('')
  const [filter, setFilter] = useState<WorkFilter>('all')
  const [verseText, setVerseText] = useState('')
  const id = verseId(state.book, state.chapter, state.verse)
  const book = bookById(state.book)
  const shelf = SHELVES.find((item) => item.books.includes(state.book))
  const rank = RANKS.find((item) => item.id === state.school.verses[id])
  const note = previewLine(state.journal[id], state.notes[id])
  const tongue = book?.testament === 'NT' ? 'Greek' : 'Hebrew'

  useEffect(() => {
    let live = true
    setVerseText('')
    readVerse(state.translation, id).then((row) => {
      if (live) setVerseText(row?.text ?? '')
    }).catch(() => {
      if (live) setVerseText('')
    })
    return () => {
      live = false
    }
  }, [id, state.translation])

  const marked = state.marks.filter((item) => parseRef(item))
  const highlighted = Object.keys(state.highlights).filter((item) => parseRef(item))
  const noted = [...new Set([...Object.keys(state.notes), ...Object.keys(state.journal)])].filter((item) => parseRef(item) && hasWriting(state.journal[item], state.notes[item]))
  const ranked = Object.entries(state.school.verses)
    .filter((entry): entry is [string, RankName] => RANKS.some((item) => item.id === entry[1]) && Boolean(parseRef(entry[0])))
  const all = [...new Set([...marked, ...highlighted, ...noted, ...ranked.map((entry) => entry[0])])]
  const unfinished = [...new Set([...noted])].filter((item) => rankIndex(state.school.verses[item]) < rankIndex('theologian'))

  function versesFor(next: WorkFilter): string[] {
    if (next === 'all') return all
    if (next === 'marked') return marked
    if (next === 'highlighted') return highlighted
    if (next === 'notes') return noted
    return ranked.filter((entry) => entry[1] === next).map((entry) => entry[0])
  }

  const shown = versesFor(filter).sort((a, b) => verseOrder(a) - verseOrder(b))
  const waiting = unfinished.sort((a, b) => verseOrder(a) - verseOrder(b))

  function lineFor(verse: string): string {
    const text = previewLine(state.journal[verse], state.notes[verse])
    if (text) return text
    if (state.highlights[verse]) return 'Highlighted'
    if (state.marks.includes(verse)) return 'Marked'
    const held = RANKS.find((item) => item.id === state.school.verses[verse])
    return held ? held.line : ''
  }

  return (
    <div className="study-home">
      <section className="study-continue" aria-label="Continue">
        <p className="kicker">{shelf ? `${shelf.name} · ${tongue}` : tongue}</p>
        <h1>{formatRef(id)}</h1>
        <p className="study-verse-text">{verseText || 'Opening the verse…'}</p>
        <p className="quiet">{rank ? `${rank.label}. ${rank.line}` : 'Not yet ranked.'}</p>
        {note ? <p>{note}</p> : null}
        <button type="button" className="choice gold" onClick={() => go(`/study/${state.book}/${state.chapter}/${state.verse}`)}>
          Continue
        </button>
      </section>

      <section className="study-method" aria-label="How Study works">
        <p className="kicker">How Study works</p>
        <h2>Four steps</h2>
        <ol>
          {METHOD.map((step) => (
            <li key={step.title} className={step.ink}>
              <p className="kicker">{step.n}</p>
              <h3>{step.title}</h3>
              <p>{step.line}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="study-finish" aria-label="Finish these">
        <p className="kicker">{waiting.length === 1 ? '1 verse' : `${waiting.length} verses`}</p>
        <h2>Finish these</h2>
        {waiting.length === 0 ? <p className="quiet">A note that has not reached Placed will wait here.</p> : (
          <div className="work-list">
            {waiting.map((verse) => {
              const path = studyPath(verse)
              if (!path) return null
              return (
                <button key={verse} type="button" className="work-row" onClick={() => go(path)}>
                  <span className="work-ref">{formatRef(verse)}</span>
                  <span className="work-line">{lineFor(verse)}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="study-worklist" aria-label="Your work">
        <p className="kicker">{shown.length === 1 ? '1 verse' : `${shown.length} verses`}</p>
        <h2>Your work</h2>
        <div className="chips" role="group" aria-label="Filter">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? 'chip on' : 'chip'}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {shown.length === 0 ? <p className="quiet">{EMPTY[filter]}</p> : (
          <div className="work-list">
            {shown.map((verse) => {
              const path = studyPath(verse)
              if (!path) return null
              const held = RANKS.find((item) => item.id === state.school.verses[verse])
              return (
                <button key={verse} type="button" className="work-row" onClick={() => go(path)}>
                  <span className="work-ref">{formatRef(verse)}{held ? ` · ${held.label}` : ''}</span>
                  <span className="work-line">{lineFor(verse)}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="folios" aria-label="Collections">
        <p className="kicker">Collections</p>
        <h2>Named sets</h2>
        <p className="quiet">A named set of verses, kept on this device.</p>
        {state.folios.length >= 40 ? (
          <p className="quiet">Forty collections is the limit on this device.</p>
        ) : (
          <form
            className="folio-create"
            onSubmit={(event) => {
              event.preventDefault()
              const name = title.trim()
              if (!name) return
              if (createFolio(name)) setTitle('')
            }}
          >
            <input
              value={title}
              maxLength={60}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Name this collection"
              aria-label="Collection name"
            />
            <button type="submit" className="choice" disabled={!title.trim()}>Create collection</button>
          </form>
        )}
        {state.folios.length === 0 ? <p className="quiet">No collection yet.</p> : null}
        {state.folios.map((folio) => (
          <article key={folio.id} className="folio">
            <input
              className="folio-name"
              value={drafts[folio.id] ?? folio.title}
              maxLength={60}
              aria-label={`Name of ${folio.title}`}
              onChange={(event) => setDrafts((current) => ({ ...current, [folio.id]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              onBlur={() => {
                const next = (drafts[folio.id] ?? folio.title).trim()
                if (next && next !== folio.title) renameFolio(folio.id, next)
                setDrafts((current) => {
                  const copy = { ...current }
                  delete copy[folio.id]
                  return copy
                })
              }}
            />
            {folio.verses.length === 0 ? <p className="quiet">No verse in this collection.</p> : (
              <ListenButton
                scriptKey={`folio:${folio.id}:${state.translation}`}
                title={folio.title}
                label="Read this collection"
                className="choice"
                translation={state.translation}
                lines={() => verseScripts(folio.verses, state.translation)}
              />
            )}
            <div className="folio-verses">
              {folio.verses.map((verse) => {
                const path = studyPath(verse)
                if (!path) return null
                return (
                  <div key={verse} className="folio-verse">
                    <button type="button" className="ref-link" onClick={() => go(path)}>{formatRef(verse)}</button>
                    <button type="button" className="text-btn" onClick={() => removeVerseFromFolio(folio.id, verse)}>
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
            {pendingDelete === folio.id ? (
              <div className="row">
                <button type="button" className="choice" onClick={() => { deleteFolio(folio.id); setPendingDelete('') }}>
                  Delete this collection
                </button>
                <button type="button" className="text-btn" onClick={() => setPendingDelete('')}>Keep</button>
              </div>
            ) : (
              <button type="button" className="text-btn" onClick={() => setPendingDelete(folio.id)}>Delete</button>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
