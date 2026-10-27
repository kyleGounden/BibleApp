import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { SHELVES, bookById, formatRef, parseRef, verseId } from '../lib/canon'
import { loadBook, loadGloss, loadOriginal, loadXrefs, plain, translationName, type BookFile, type Gloss, type OriginalWord, type Translation, type Verse, type XRefGroup } from '../lib/bible'
import { threadsForVerse, loadTrails, type ThreadHit, type Trail } from '../lib/catalog'
import { EsvError, readEsvVerse, useEsvToken } from '../lib/esv'
import { NivError, readNivVerse } from '../lib/niv'
import { functionWord } from '../lib/grammar'
import { bookGuide, useGuides } from '../lib/guide'
import { loadPlaces, placesInText, type Place } from '../lib/places'
import { go, type Route } from '../lib/router'
import { SHELVES as SHELF_COPY, RANKS, rankIndex, type RankName } from '../lib/school'
import { addMemory, addVerseToFolio, createFolio, inkHex, learnVerse, memoryLimitNote, setHighlight, setJournal, setNote, setPosition, toggleMark, useAppState, type Journal } from '../lib/storage'
import { ChurchNote } from './ChurchNote'
import { useVoice } from '../lib/speech'
import { GrammarBlock, WordLesson } from '../teach'
import { EsvNotice, NivNotice, GodLine, ListenButton, SpokenText, VerseText, hostedVerseGod, useDivineBook, useHostedGod, verseMark, type WordAsk } from '../ui'
import { verseGod } from '../lib/divine'

type StepId = 'read' | 'words' | 'links' | 'notes'

const STEPS: { id: StepId; n: string; title: string; ink: string }[] = [
  { id: 'read', n: '01', title: 'Read', ink: 'ink-gold' },
  { id: 'words', n: '02', title: 'Words', ink: 'ink-olive' },
  { id: 'links', n: '03', title: 'Links', ink: 'ink-sky' },
  { id: 'notes', n: '04', title: 'Notes', ink: 'ink-violet' },
]

const RECORD_FIELDS: { key: keyof Journal; title: string; placeholder: string }[] = [
  { key: 'see', title: 'What it says', placeholder: 'What the sentence says, before a conclusion.' },
  { key: 'original', title: 'What the original says', placeholder: 'The word, its grammar, and the sense in this sentence.' },
  { key: 'canon', title: 'Where else Scripture speaks', placeholder: 'The texts before and after this one.' },
  { key: 'conclude', title: 'What I may conclude', placeholder: 'Only what the words, the kind of book, and the canon can carry.' },
]

const RANK_ACTION: Record<RankName, string> = {
  novice: 'I know this word',
  reader: 'I can read its form',
  exegete: 'I can compare this',
  theologian: 'I can place this',
}

const EDITIONS: { id: Translation; title: string }[] = [
  { id: 'kjv', title: 'King James Version' },
  { id: 'web', title: 'World English Bible' },
  { id: 'esv', title: 'English Standard Version' },
  { id: 'niv', title: 'New International Version' },
]

function englishOf(verse: Verse | undefined, strong?: string): { phrase: string; n: number } | null {
  if (!verse || typeof verse === 'string' || !strong) return null
  for (const token of verse) {
    const ids = token[1]?.split('+').filter(Boolean) ?? []
    if (ids.includes(strong)) return { phrase: token[0].replace(/\s+/g, ' ').trim(), n: ids.length }
  }
  return null
}

function linkedEnglish(list: OriginalWord[], index: number, verse: Verse | undefined): { phrase: string; n: number; strong: string } | null {
  if (!verse || typeof verse === 'string' || !list.length) return null
  const at = Math.min(Math.max(index, 0), list.length - 1)
  const order = [at]
  for (let step = 1; step < list.length; step++) {
    if (at + step < list.length) order.push(at + step)
    if (at - step >= 0) order.push(at - step)
  }
  for (const cursor of order) {
    const strong = list[cursor]?.s
    if (!strong) continue
    const found = englishOf(verse, strong)
    if (found) return { ...found, strong }
  }
  return null
}

const SKIP_MARK = new Set(['the', 'of', 'and'])

function phraseOccurs(text: string, needle: string): boolean {
  const hay = text.toLowerCase()
  const want = needle.toLowerCase()
  let from = 0
  while (want && from < hay.length) {
    const at = hay.indexOf(want, from)
    if (at < 0) return false
    const end = at + want.length
    const before = at > 0 ? text[at - 1] : ''
    const after = text[end] ?? ''
    if (!/[A-Za-z]/.test(before) && !/[A-Za-z]/.test(after)) return true
    from = end
  }
  return false
}

function visiblePhrase(phrase: string | undefined, text: string): string | undefined {
  if (!phrase || !text) return undefined
  if (phraseOccurs(text, phrase)) return phrase
  const parts = phrase.split(/[^A-Za-z']+/).filter((word) => word && !SKIP_MARK.has(word.toLowerCase()))
  parts.sort((a, b) => b.length - a.length)
  return parts.find((word) => phraseOccurs(text, word))
}

function strongsInKjv(verse: Verse | undefined, surface: string): string[] {
  if (!verse || typeof verse === 'string') return []
  const want = surface.toLowerCase()
  for (const token of verse) {
    const ids = token[1]?.split('+').filter(Boolean) ?? []
    if (!ids.length) continue
    const parts = token[0].toLowerCase().split(/[^a-z']+/).filter(Boolean)
    if (parts.includes(want)) return ids
  }
  return []
}

function preferredStrong(ids: string[], surface: string, gloss: Record<string, Gloss>): string | undefined {
  const wants = surface.toLowerCase().split(/[^a-z']+/).filter(Boolean)
  for (const want of [...wants].reverse()) {
    for (const id of ids) {
      const renderings = (gloss[id]?.g ?? '').toLowerCase().split(/[^a-z']+/).filter(Boolean)
      if (renderings.includes(want)) return id
    }
  }
  return ids.length > 1 ? ids[ids.length - 1] : ids[0]
}

function fromGloss(verse: Verse | undefined, gloss: Record<string, Gloss>): OriginalWord[] {
  if (!verse || typeof verse === 'string') return []
  const words: OriginalWord[] = []
  for (const token of verse) {
    for (const strong of token[1]?.split('+').filter(Boolean) ?? []) {
      const entry = gloss[strong]
      if (entry?.l) words.push({ w: entry.l, m: '', s: strong })
    }
  }
  return words
}

function languageOf(word: OriginalWord | undefined, testament: 'OT' | 'NT'): string {
  if (testament === 'NT') return 'Greek'
  if (word?.m.startsWith('A')) return 'Aramaic'
  return 'Hebrew'
}

function noteCount(journal: Journal | undefined, note: string | undefined): number {
  const fields = RECORD_FIELDS.filter((field) => journal?.[field.key]?.trim()).length
  return fields + (note?.trim() ? 1 : 0)
}

function RankMark({ id, rank, have }: { id: string; rank: RankName; have: number }) {
  const done = have >= rankIndex(rank)
  const info = RANKS.find((item) => item.id === rank)
  return (
    <div className="rank-mark">
      <button type="button" className={done ? 'text-btn gold' : 'choice'} disabled={done} onClick={() => learnVerse(id, rank)}>
        {done ? (info?.label ?? 'Learned') : RANK_ACTION[rank]}
      </button>
      {info ? <p className="quiet">{info.line}</p> : null}
    </div>
  )
}

function CollectionAdd({ id }: { id: string }) {
  const folios = useAppState().folios
  const [name, setName] = useState('')
  const [note, setNoteText] = useState('')

  useEffect(() => {
    setNoteText('')
  }, [id])

  return (
    <div className="folio-band" aria-label="Collection">
      <p className="kicker">Collection</p>
      <p className="quiet">A named set of verses, kept on this device.</p>
      {folios.length ? (
        <div className="chips">
          {folios.map((folio) => {
            const inside = folio.verses.includes(id)
            const full = !inside && folio.verses.length >= 80
            return (
              <button
                key={folio.id}
                type="button"
                className={inside ? 'chip on' : 'chip'}
                disabled={inside || full}
                onClick={() => {
                  const added = addVerseToFolio(folio.id, id)
                  setNoteText(added ? `Added to ${folio.title}.` : `${folio.title} is full.`)
                }}
              >
                {inside ? `In ${folio.title}` : full ? `${folio.title} is full` : `Add to ${folio.title}`}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="quiet">No collection yet. Name one and this verse is the first line.</p>
      )}
      {folios.length >= 40 ? (
        <p className="quiet">Forty collections is the limit on this device.</p>
      ) : (
        <form
          className="folio-create"
          onSubmit={(event) => {
            event.preventDefault()
            const title = name.trim()
            if (!title) return
            const folioId = createFolio(title)
            if (!folioId) return
            addVerseToFolio(folioId, id)
            setName('')
            setNoteText(`Added to ${title}.`)
          }}
        >
          <input
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="New collection"
            aria-label="New collection name"
          />
          <button type="submit" className="choice" disabled={!name.trim()}>Create and add</button>
        </form>
      )}
      {note ? <p className="quiet">{note}</p> : null}
    </div>
  )
}

export function Study({
  route,
  onWord,
}: {
  route: Extract<Route, { name: 'study' }>
  onWord: (ask: WordAsk) => void
}) {
  const state = useAppState()
  const guides = useGuides()
  const voice = useVoice()
  const esvToken = useEsvToken()
  const book = bookById(route.book)
  const kjvGod = useDivineBook('kjv', book?.id ?? null)
  const webGod = useDivineBook('web', book?.id ?? null)
  const [kjv, setKjv] = useState<BookFile | null>(null)
  const [web, setWeb] = useState<BookFile | null>(null)
  const [original, setOriginal] = useState<OriginalWord[] | null>(null)
  const [groups, setGroups] = useState<XRefGroup[]>([])
  const [threads, setThreads] = useState<ThreadHit[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [gloss, setGloss] = useState<Record<string, Gloss>>({})
  const [places, setPlaces] = useState<Place[]>([])
  const [hostedText, setHostedText] = useState('')
  const [hostedNote, setHostedNote] = useState('')
  const [pick, setPick] = useState(0)
  const [step, setStep] = useState<StepId>('read')
  const [openedFor, setOpenedFor] = useState('')
  const [opened, setOpened] = useState({ read: true, words: false, links: false })
  const [memoryNote, setMemoryNote] = useState('')
  const [lineOpen, setLineOpen] = useState(false)
  const [aroundOpen, setAroundOpen] = useState(false)
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 959px)').matches)
  const stripRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDetailsElement>(null)
  const pendingScroll = useRef<'line' | 'word' | 'rail' | null>(null)
  const [scrollTick, setScrollTick] = useState(0)
  const id = verseId(route.book, route.chapter, route.verse)
  const journal = state.journal[id]

  if (openedFor !== id) {
    setOpenedFor(id)
    setStep('read')
    setOpened({ read: true, words: false, links: false })
    setMemoryNote('')
    setLineOpen(false)
    setAroundOpen(false)
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 959px)')
    const apply = () => setNarrow(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    setPosition(route.book, route.chapter, route.verse)
  }, [route.book, route.chapter, route.verse])

  useEffect(() => {
    if (!book) return
    let live = true
    setOriginal(null)
    loadBook('kjv', book.id).then((next) => live && setKjv(next)).catch(() => live && setKjv(null))
    loadBook('web', book.id).then((next) => live && setWeb(next)).catch(() => live && setWeb(null))
    loadOriginal(book.id).then((next) => {
      if (live) setOriginal(next.chapters[String(route.chapter)]?.[String(route.verse)] ?? [])
    }).catch(() => live && setOriginal([]))
    loadXrefs(book.id).then((refs) => {
      if (live) setGroups(refs[`${route.chapter}:${route.verse}`] ?? [])
    })
    threadsForVerse(id).then((hits) => live && setThreads(hits)).catch(() => live && setThreads([]))
    loadTrails().then((all) => live && setTrails(all.filter((trail) => trail.verses.includes(id)))).catch(() => live && setTrails([]))
    loadGloss().then((next) => live && setGloss(next)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [book, route.chapter, route.verse, id])

  useEffect(() => {
    if (state.translation !== 'esv' && state.translation !== 'niv') return
    let live = true
    setHostedText('')
    setHostedNote('')
    const request = state.translation === 'niv' ? readNivVerse(id) : readEsvVerse(id)
    request
      .then((text) => {
        if (live) setHostedText(text)
      })
      .catch((err: unknown) => {
        if (live) setHostedNote(err instanceof EsvError || err instanceof NivError ? err.message : 'The text did not load.')
      })
    return () => {
      live = false
    }
  }, [id, state.translation, esvToken])

  const hostedPack = useHostedGod(
    state.translation === 'esv' || state.translation === 'niv' ? state.translation : null,
    route.book,
    route.chapter,
  )
  const kjvVerse = kjv?.chapters[String(route.chapter)]?.[String(route.verse)]
  const webVerse = web?.chapters[String(route.chapter)]?.[String(route.verse)]
  const pointed = original ?? []
  const fallback = original !== null && pointed.length === 0
  const words = pointed.length ? pointed : fromGloss(kjvVerse, gloss)
  const chosen = Math.min(pick, Math.max(words.length - 1, 0))
  const word = words[chosen]
  const language = languageOf(word, book?.testament ?? 'OT')
  const rtl = book?.testament === 'OT'
  const learned = rankIndex(state.school.verses[id])
  const shelf = SHELVES.find((item) => item.books.includes(route.book))
  const guide = guides ? bookGuide(guides, route.book) : undefined
  const shelfCopy = shelf ? SHELF_COPY[shelf.name] : undefined
  const chapter = kjv?.chapters[String(route.chapter)]
  const numbers = chapter ? Object.keys(chapter).map(Number).sort((a, b) => a - b) : []
  const previous = numbers.filter((number) => number < route.verse).pop()
  const next = numbers.find((number) => number > route.verse)
  const hit = englishOf(kjvVerse, word?.s)
  const linked = linkedEnglish(words, chosen, kjvVerse)
  const open = STEPS.find((item) => item.id === step) ?? STEPS[0]
  const activeStrongs = linked ? [linked.strong] : []
  const markIn = (text: string) => visiblePhrase(linked?.phrase, text)
  const notes = noteCount(journal, state.notes[id])
  const xrefCount = groups.reduce((sum, group) => sum + group.v.length, 0)
  const linkCount = places.length + xrefCount + trails.length + threads.length
  const hosted = state.translation === 'esv' || state.translation === 'niv'
  const ready = [plain(kjvVerse), plain(webVerse), hostedText].filter(Boolean).length
  const doneCount = [opened.read, opened.words, opened.links, notes > 0].filter(Boolean).length
  const activeText = hosted ? hostedText : state.translation === 'web' ? plain(webVerse) : plain(kjvVerse)
  const marked = markIn(activeText)
  const readingName = translationName(state.translation)
  const aside = !word
    ? ''
    : state.translation === 'kjv'
      ? hit
        ? hit.n > 1
          ? `The King James gathers this with other original words into “${hit.phrase}.”`
          : `The King James reads “${hit.phrase}.”`
        : !word.s && functionWord(word.w, word.m)
          ? 'This is written as part of the word beside it.'
          : ''
      : marked
        ? `The ${readingName} reads “${marked}.”`
        : hit
          ? `This word is not in the ${readingName}. The King James reads “${hit.phrase}.”`
          : !word.s && functionWord(word.w, word.m)
            ? 'This is written as part of the word beside it.'
            : ''
  const inMemory = state.deck.some((card) => card.translation === state.translation && card.verses.length === 1 && card.verses[0] === id)
  const inkId = state.highlights[id]
  const ink = inkId ? state.palette.find((item) => item.id === inkId) : undefined
  const hex = ink ? inkHex(ink.color) : null
  const stageStyle = hex ? { '--ink': hex } as CSSProperties : undefined

  const wordKey = words.map((item) => `${item.w}:${item.s ?? ''}`).join('|')
  useEffect(() => {
    const index = words.findIndex((item) => item.s)
    setPick(index < 0 ? 0 : index)
  }, [wordKey])

  useEffect(() => {
    const text = plain(kjvVerse)
    if (!text) return
    let live = true
    loadPlaces().then((all) => live && setPlaces(placesInText(all, text))).catch(() => live && setPlaces([]))
    return () => {
      live = false
    }
  }, [kjvVerse])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        setPick((value) => Math.min(words.length - 1, value + 1))
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        setPick((value) => Math.max(0, value - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [words.length])

  useEffect(() => {
    const strip = stripRef.current
    const node = strip?.querySelector<HTMLButtonElement>('.on')
    if (!strip || !node) return
    const stripBox = strip.getBoundingClientRect()
    const nodeBox = node.getBoundingClientRect()
    strip.scrollLeft += nodeBox.left - stripBox.left - (stripBox.width - nodeBox.width) / 2
  }, [route.book, route.chapter, route.verse, numbers.length])

  function queueStudyScroll(kind: 'line' | 'word' | 'rail') {
    pendingScroll.current = kind
    setScrollTick((tick) => tick + 1)
  }

  function openStep(nextStep: StepId) {
    setStep(nextStep)
    if (nextStep === 'read' || nextStep === 'words' || nextStep === 'links') {
      setOpened((current) => ({ ...current, [nextStep]: true }))
    }
    if (nextStep === 'words') setLineOpen(true)
    queueStudyScroll(nextStep === 'words' ? 'line' : 'rail')
  }

  function chooseWord(index: number, fromEnglish = false) {
    setPick(index)
    setStep('words')
    setOpened((current) => ({ ...current, words: true }))
    setLineOpen(true)
    if (fromEnglish) queueStudyScroll('word')
  }

  useLayoutEffect(() => {
    const kind = pendingScroll.current
    if (!kind) return
    pendingScroll.current = null
    if (!window.matchMedia('(max-width: 959px)').matches) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const word = lineRef.current?.querySelector<HTMLElement>('.orig-word.on')
    const node = kind === 'rail' ? railRef.current : kind === 'word' ? (word ?? lineRef.current) : lineRef.current
    node?.scrollIntoView({ block: 'start', behavior })
  }, [scrollTick])

  function selectEnglish(surface: string, strongs: string[]) {
    const ids = strongs.length ? strongs : strongsInKjv(kjvVerse, surface)
    const chosen = preferredStrong(ids, surface, gloss)
    const index = words.findIndex((item) => item.s === chosen)
    const fallback = index >= 0 ? index : words.findIndex((item) => item.s && ids.includes(item.s))
    if (fallback >= 0) {
      chooseWord(fallback, true)
      return
    }
    onWord({ surface, strongs: ids, ref: id })
  }

  if (!book) return <p>That book is not in the canon.</p>
  const tongue = book.testament === 'NT' ? 'Greek' : pointed.some((item) => item.m.startsWith('A')) && pointed.every((item) => !item.m || item.m.startsWith('A')) ? 'Aramaic' : pointed.some((item) => item.m.startsWith('A')) ? 'Hebrew and Aramaic' : 'Hebrew'
  const editions = [...EDITIONS].sort((a, b) => Number(b.id === state.translation) - Number(a.id === state.translation))
  const counts: Record<StepId, number> = { read: ready, words: words.length, links: linkCount, notes }
  const pips = { read: opened.read, words: opened.words, links: opened.links, notes: notes > 0 }

  return (
    <div className="studio">
      <button type="button" className="text-btn" onClick={() => go('/study')}>Back to Study</button>
      <div className="study-work">
        <div className="study-stage-col">
          <section className="study-stage" aria-label="Verse">
            <p className="kicker">Study</p>
            <h1>{formatRef(id)}</h1>
            <p className="lede study-direction">{tongue}. {rtl ? 'Read each word from the right.' : 'Read each word from the left.'}</p>
            <div className={hex ? 'study-verse inked' : 'study-verse'} style={stageStyle}>
              <p className="vt">
                {hosted ? (
                  hostedText
                    ? <SpokenText text={hostedText} god={hostedVerseGod(hostedPack, route.verse, hostedText)} mark={verseMark(voice, id, state.translation)} phrase={markIn(hostedText)} />
                    : (hostedNote ? '' : 'Opening the verse…')
                ) : state.translation === 'web' ? (
                  webVerse
                    ? <VerseText verse={webVerse} god={verseGod(webGod, route.chapter, route.verse)} spokenAt={verseMark(voice, id, 'web')} phrase={markIn(plain(webVerse))} onWord={selectEnglish} />
                    : 'Opening the verse…'
                ) : (
                  kjvVerse
                    ? <VerseText verse={kjvVerse} god={verseGod(kjvGod, route.chapter, route.verse)} spokenAt={verseMark(voice, id, 'kjv')} activeStrongs={activeStrongs} onWord={selectEnglish} />
                    : 'Opening the verse…'
                )}
              </p>
              {hosted && hostedNote ? <p className="miss">{hostedNote}</p> : null}
              {state.translation === 'esv' && hostedText ? <EsvNotice /> : null}
              {state.translation === 'niv' && hostedText ? <NivNotice /> : null}
            </div>
            <div className="study-tools">
              <ListenButton
                scriptKey={`study:${state.translation}:${id}`}
                title={formatRef(id)}
                label="Read aloud"
                className="choice gold"
                translation={state.translation}
                lines={[{
                  key: id,
                  label: formatRef(id),
                  text: activeText,
                  book: book.id,
                  chapter: route.chapter,
                  verse: route.verse,
                  href: `/read/${book.id}/${route.chapter}/${route.verse}`,
                }]}
              />
              <button type="button" className="choice" disabled={previous == null} onClick={() => previous != null && go(`/study/${book.id}/${route.chapter}/${previous}`)}>Previous</button>
              <button type="button" className="choice" disabled={next == null} onClick={() => next != null && go(`/study/${book.id}/${route.chapter}/${next}`)}>Next</button>
              <button type="button" className={state.marks.includes(id) ? 'choice gold' : 'choice'} onClick={() => toggleMark(id)}>
                {state.marks.includes(id) ? 'Marked' : 'Mark'}
              </button>
            </div>
            <div className="inks" role="group" aria-label="Highlight">
              {state.palette.map((color) => {
                const colorHex = inkHex(color.color)
                if (!colorHex) return null
                const pressed = inkId === color.id
                return (
                  <button
                    key={color.id}
                    type="button"
                    className={['swatch', color.label ? 'pill' : '', pressed ? 'on' : ''].filter(Boolean).join(' ')}
                    style={color.label ? undefined : { background: colorHex }}
                    aria-label={color.label ? `Highlight ${color.label}` : `Highlight ${color.id}`}
                    aria-pressed={pressed}
                    onClick={() => setHighlight([id], color.id)}
                  >
                    {color.label ? <><i style={{ background: colorHex }} aria-hidden="true" />{color.label}</> : null}
                  </button>
                )
              })}
            </div>
            <div className="verse-strip" aria-label="Verses" ref={stripRef}>
              {numbers.map((number) => (
                <button key={number} type="button" className={number === route.verse ? 'on' : ''} onClick={() => go(`/study/${book.id}/${route.chapter}/${number}`)}>
                  {number}
                </button>
              ))}
            </div>
          </section>

          <details className="study-fold study-around" open={!narrow || aroundOpen} onToggle={(event) => { if (window.matchMedia('(max-width: 959px)').matches) setAroundOpen(event.currentTarget.open) }}>
            <summary>
              <span className="kicker">Around it</span>
              <span className="study-fold-title">The sentences beside this one</span>
            </summary>
            <div className="study-fold-body">
            <p className="kicker study-fold-label">Around it</p>
            <h2 className="study-fold-label">The sentences beside this one</h2>
            {kjv == null ? <p className="quiet">Opening the sentences beside it…</p> : null}
            {kjv != null && previous == null && next == null ? <p className="quiet">This verse stands alone in the chapter.</p> : null}
            <div className="pair">
              <article>
                <p className="kicker">Before</p>
                {kjv == null ? null : previous == null ? <p className="quiet">This is the first verse of the chapter.</p> : (
                  <>
                    <p>
                      <GodLine
                        translation="kjv"
                        id={verseId(book.id, route.chapter, previous)}
                        text={plain(kjv?.chapters[String(route.chapter)]?.[String(previous)])}
                        mark={verseMark(voice, verseId(book.id, route.chapter, previous), 'kjv')}
                      />
                    </p>
                    <ListenButton
                      scriptKey={`study:kjv:${verseId(book.id, route.chapter, previous)}`}
                      title={`Before ${formatRef(verseId(book.id, route.chapter, previous))}`}
                      translation="kjv"
                      lines={[{
                        key: verseId(book.id, route.chapter, previous),
                        label: formatRef(verseId(book.id, route.chapter, previous)),
                        text: plain(kjv?.chapters[String(route.chapter)]?.[String(previous)]),
                        book: book.id,
                        chapter: route.chapter,
                        verse: previous,
                        href: `/read/${book.id}/${route.chapter}/${previous}`,
                      }]}
                    />
                  </>
                )}
              </article>
              <article>
                <p className="kicker">After</p>
                {kjv == null ? null : next == null ? <p className="quiet">This is the last verse of the chapter.</p> : (
                  <>
                    <p>
                      <GodLine
                        translation="kjv"
                        id={verseId(book.id, route.chapter, next)}
                        text={plain(kjv?.chapters[String(route.chapter)]?.[String(next)])}
                        mark={verseMark(voice, verseId(book.id, route.chapter, next), 'kjv')}
                      />
                    </p>
                    <ListenButton
                      scriptKey={`study:kjv:${verseId(book.id, route.chapter, next)}`}
                      title={`After ${formatRef(verseId(book.id, route.chapter, next))}`}
                      translation="kjv"
                      lines={[{
                        key: verseId(book.id, route.chapter, next),
                        label: formatRef(verseId(book.id, route.chapter, next)),
                        text: plain(kjv?.chapters[String(route.chapter)]?.[String(next)]),
                        book: book.id,
                        chapter: route.chapter,
                        verse: next,
                        href: `/read/${book.id}/${route.chapter}/${next}`,
                      }]}
                    />
                  </>
                )}
              </article>
            </div>
            </div>
          </details>

          <details
            className="study-fold manuscript"
            ref={lineRef}
            open={!narrow || lineOpen}
            onToggle={(event) => { if (window.matchMedia('(max-width: 959px)').matches) setLineOpen(event.currentTarget.open) }}
          >
            <summary>
              <span className="kicker">Original (manuscript)</span>
              <span className="study-fold-title">{tongue}</span>
            </summary>
            <div className="study-fold-body">
            <p className="kicker study-fold-label">Original (manuscript)</p>
            <p className="lede study-direction">{tongue}. {rtl ? 'Read each word from the right.' : 'Read each word from the left.'} The word you choose is marked in the verse above.</p>
            {original === null ? <p className="quiet">Opening the {tongue.toLowerCase()}…</p> : null}
            {fallback ? <p className="quiet">These are the dictionary forms behind the King James words.</p> : null}
            {words.length ? (
              <>
                <div className={rtl ? 'orig-line rtl' : 'orig-line'} dir={rtl ? 'rtl' : 'ltr'}>
                  {words.map((item, index) => (
                    <button
                      key={`${item.w}-${item.m}-${index}`}
                      type="button"
                      className={['orig-word', languageOf(item, book.testament) === 'Greek' ? 'gr' : 'he', index === chosen ? 'on' : ''].filter(Boolean).join(' ')}
                      onClick={() => chooseWord(index)}
                    >
                      <span>{item.w}</span>
                    </button>
                  ))}
                </div>
                {word ? <p className={`manuscript-word ${language === 'Greek' ? 'gr' : 'he'}`} dir={rtl ? 'rtl' : 'ltr'}>{word.w}</p> : null}
                {aside ? <p>{aside}</p> : null}
              </>
            ) : original !== null ? <p className="quiet">No original words are recorded for this verse.</p> : null}
            </div>
          </details>
        </div>

        <div className="study-step-col">
          <div className="study-step-head" ref={railRef}>
          <div className="step-progress" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={doneCount} aria-label="Study progress">
            <i style={{ width: `${(doneCount / 4) * 100}%` }} />
          </div>
          <div className="step-rail" role="tablist" aria-label="Study steps">
            {STEPS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`step-${item.id}`}
                className={item.id === open.id ? `${item.ink} on` : item.ink}
                aria-selected={item.id === open.id}
                onClick={() => openStep(item.id)}
              >
                <span className={pips[item.id] ? 'step-pip on' : 'step-pip'} />
                <span className="chamber-n">{item.n}</span>
                <span className="step-name">{item.title}</span>
                <span className="step-count">{counts[item.id]}</span>
              </button>
            ))}
          </div>
          </div>

          <section
            key={open.id}
            className={`chamber ${open.ink}`}
            role="tabpanel"
            aria-labelledby={`step-${open.id}`}
          >
            <p className="kicker">{open.n}</p>
            <h2>{open.title}</h2>

            {open.id === 'read' ? (
              <>
                <div className="witnesses">
                  {editions.map((edition) => (
                    <section key={edition.id} className={edition.id === state.translation ? 'witness on' : 'witness'}>
                      <p className="kicker">{translationName(edition.id)}</p>
                      {edition.id === 'esv' || edition.id === 'niv' ? (
                        state.translation === edition.id ? (
                          <>
                            <p className="vt">{hostedText ? <SpokenText text={hostedText} god={hostedVerseGod(hostedPack, route.verse, hostedText)} mark={verseMark(voice, id, edition.id)} phrase={markIn(hostedText)} /> : (hostedNote ? '' : 'Opening the verse…')}</p>
                            {hostedNote ? <p className="miss">{hostedNote}</p> : null}
                            {hostedText ? (edition.id === 'niv' ? <NivNotice /> : <EsvNotice />) : null}
                          </>
                        ) : (
                          <p className="quiet">Choose {edition.id === 'niv' ? 'NIV' : 'ESV'} in the bar above when you want that witness too.</p>
                        )
                      ) : (
                        <p className="vt">
                          {edition.id === 'kjv' ? (
                            kjvVerse
                              ? <VerseText verse={kjvVerse} god={verseGod(kjvGod, route.chapter, route.verse)} spokenAt={verseMark(voice, id, 'kjv')} activeStrongs={activeStrongs} onWord={selectEnglish} />
                              : '—'
                          ) : (
                            webVerse
                              ? <VerseText verse={webVerse} god={verseGod(webGod, route.chapter, route.verse)} spokenAt={verseMark(voice, id, 'web')} phrase={markIn(plain(webVerse))} onWord={selectEnglish} />
                              : '—'
                          )}
                        </p>
                      )}
                    </section>
                  ))}
                </div>
                <RankMark id={id} rank="exegete" have={learned} />
              </>
            ) : null}

            {open.id === 'words' ? (
              word ? (
                <>
                  <h3>Meaning</h3>
                  <WordLesson word={word} gloss={word.s ? gloss[word.s] : null} language={language} aside={aside} />
                  {hit ? (
                    <button type="button" className="text-btn" onClick={() => onWord({ surface: hit.phrase, strongs: word.s ? [word.s] : [], ref: id })}>
                      English word
                    </button>
                  ) : null}
                  <h3>Form</h3>
                  <GrammarBlock morph={word.m} />
                  <RankMark id={id} rank="novice" have={learned} />
                  <RankMark id={id} rank="reader" have={learned} />
                </>
              ) : <p className="quiet">Choose a word in the line above.</p>
            ) : null}

            {open.id === 'links' ? (
              <>
                <div className="canon-block">
                  <h3>How to read this book</h3>
                  {shelf && shelfCopy ? (
                    <>
                      <p className="quiet">{shelf.name}</p>
                      {guide ? (
                        <>
                          <p>{guide.line}. {guide.purpose}</p>
                          <button type="button" className="text-btn" onClick={() => go(`/book/${route.book}`)}>About this book</button>
                        </>
                      ) : null}
                      <p><SpokenText text={shelfCopy.read} mark={voice.lineKey === `shelf:${shelf.name}:read` && voice.status !== 'idle' ? voice.charIndex : null} /></p>
                      <ListenButton
                        scriptKey={`shelf:${shelf.name}`}
                        title={shelf.name}
                        label="Listen"
                        lines={[
                          { key: `shelf:${shelf.name}:read`, label: shelf.name, text: shelfCopy.read, href: `/study/${book.id}/${route.chapter}/${route.verse}` },
                          { key: `shelf:${shelf.name}:guard`, label: 'What this verse cannot carry', text: shelfCopy.guard, href: `/study/${book.id}/${route.chapter}/${route.verse}` },
                        ]}
                      />
                    </>
                  ) : <p className="quiet">This book is not placed on a shelf.</p>}
                </div>
                <div className="canon-block">
                  <h3>What this verse cannot carry</h3>
                  {shelfCopy ? <p><SpokenText text={shelfCopy.guard} mark={voice.lineKey === `shelf:${shelf?.name}:guard` && voice.status !== 'idle' ? voice.charIndex : null} /></p> : <p className="quiet">No guard is kept for this book.</p>}
                </div>
                <div className="canon-block">
                  <h3>Places</h3>
                  <p className="kicker">{places.length === 1 ? '1 place' : `${places.length} places`}</p>
                  {places.length ? (
                    <div className="chips">
                      {places.map((place) => (
                        <button key={place.id} type="button" className="chip" onClick={() => go(`/places/${place.id}`)}>{place.name}</button>
                      ))}
                    </div>
                  ) : <p className="quiet">No place in this app is named in this verse.</p>}
                </div>
                <div className="canon-block">
                  <h3>Treasury</h3>
                  <p className="kicker">{xrefCount === 1 ? '1 link' : `${xrefCount} links`}</p>
                  {groups.length === 0 ? <p className="quiet">No Treasury link is recorded for this verse.</p> : null}
                  {groups.map((group) => (
                    <div key={group.p} className="quote">
                      <p className="kicker">{group.p}</p>
                      <div className="chips">
                        {group.v.map((ref) => (
                          <button key={ref} type="button" className="chip" onClick={() => {
                            const parsed = parseRef(ref)
                            if (parsed) go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)
                          }}>{formatRef(ref)}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="canon-block">
                  <h3>Trails</h3>
                  <p className="kicker">{trails.length === 1 ? '1 trail' : `${trails.length} trails`}</p>
                  {trails.length ? (
                    <div className="chips">
                      {trails.map((trail) => (
                        <button key={trail.id} type="button" className="chip" onClick={() => go(`/trail/${trail.id}`)}>{trail.title}</button>
                      ))}
                    </div>
                  ) : <p className="quiet">No trail in this app names this verse.</p>}
                </div>
                <div className="canon-block">
                  <h3>Prophecy</h3>
                  <p className="kicker">{threads.length === 1 ? '1 thread' : `${threads.length} threads`}</p>
                  {threads.length ? (
                    <div className="chips">
                      {threads.map((thread) => (
                        <button key={thread.id} type="button" className="chip" onClick={() => go(`/prophecy/thread/${thread.id}`)}>
                          {thread.kind === 'fulfilled' ? 'Recorded' : 'Ahead'} · {thread.title}
                        </button>
                      ))}
                    </div>
                  ) : <p className="quiet">No prophecy thread in this app names this verse.</p>}
                </div>
                <RankMark id={id} rank="theologian" have={learned} />
              </>
            ) : null}

            {open.id === 'notes' ? (
              <>
                <ListenButton
                  scriptKey={`record:${id}`}
                  title={formatRef(id)}
                  label="Read the notes"
                  className="choice"
                  lines={[
                    ...RECORD_FIELDS.flatMap((field) => {
                      const text = journal?.[field.key]?.trim() ?? ''
                      return text ? [{ key: `journal:${id}:${field.key}`, label: field.title, text, href: `/study/${book.id}/${route.chapter}/${route.verse}` }] : []
                    }),
                    ...(state.notes[id]?.trim() ? [{ key: `note:${id}`, label: 'Your note', text: state.notes[id].trim(), href: `/study/${book.id}/${route.chapter}/${route.verse}` }] : []),
                  ]}
                />
                {RECORD_FIELDS.map((field) => (
                  <div key={field.key} className="record-box">
                    <h3>{field.title}</h3>
                    <textarea
                      value={journal?.[field.key] ?? ''}
                      onChange={(event) => setJournal(id, field.key, event.target.value)}
                      placeholder={field.placeholder}
                      aria-label={field.title}
                    />
                  </div>
                ))}
                <div className="record-box">
                  <h3>Your note</h3>
                  <textarea
                    value={state.notes[id] ?? ''}
                    onChange={(event) => setNote(id, event.target.value)}
                    placeholder="A note of your own, kept on this device."
                    aria-label="Your note"
                  />
                </div>
                <ChurchNote verseId={id} draft={state.notes[id] ?? ''} />
                <CollectionAdd id={id} />
                <div className="record-box">
                  <h3>This verse</h3>
                  <div className="row">
                    <button type="button" className="text-btn" onClick={() => go(`/read/${book.id}/${route.chapter}/${route.verse}`)}>Open the chapter</button>
                    <button
                      type="button"
                      className={inMemory ? 'text-btn gold' : 'text-btn'}
                      disabled={!activeText || inMemory}
                      onClick={() => {
                        const added = addMemory(state.translation, [id], activeText)
                        setMemoryNote(added ? 'Added to Memory.' : memoryLimitNote(state.translation))
                      }}
                    >
                      {inMemory ? 'In Memory' : 'Add to Memory'}
                    </button>
                  </div>
                  {memoryNote ? <p className="quiet">{memoryNote}</p> : null}
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>

      <p className="quiet credit">
        Hebrew text and morphology: Open Scriptures Hebrew Bible, CC BY 4.0. Greek text: SBL Greek New Testament, CC BY 4.0. Greek parsing: MorphGNT, CC BY-SA. Lexicon: James Strong, via Open Scriptures, CC BY-SA.
      </p>
    </div>
  )
}
