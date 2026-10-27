import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { CIRCUIT, bookById, bookName, formatRef, neighbor, parseRef, verseId } from '../lib/canon'
import { useFollow } from '../lib/follow'
import { loadBook, loadChapter, loadXrefs, plain, translationShort, type BookFile, type Verse } from '../lib/bible'
import { markHostedChapter, verseGod } from '../lib/divine'
import { EsvError, useEsvToken } from '../lib/esv'
import { threadsForVerse, type ThreadHit } from '../lib/catalog'
import { go, type Route } from '../lib/router'
import { getVoice, pauseVoice, resumeVoice, startVoice, useVoice, warmVoiceLines } from '../lib/speech'
import { loadPlaces, placesInText, type Place } from '../lib/places'
import { FollowBar } from './FollowBar'
import { SettingStrip } from './SettingStrip'
import { addInk, addMemory, inkHex, INK_LABEL_CAP, isChapterRead, markChapterRead, memoryLimitNote, PALETTE_CAP, removeInk, setHighlight, setPosition, toggleMarks, updateInk, useAppState } from '../lib/storage'
import { EsvNotice, NivNotice, VerseText, hostedVerseGod, setToolsChromeOpen, setVoiceMoreOpen, useDivineBook, useHostedGod, type HostedPack, type WordAsk } from '../ui'
import { NivError } from '../lib/niv'

function interimHosted(verses: Record<string, Verse>): HostedPack {
  const nums = Object.keys(verses).map(Number).sort((a, b) => a - b)
  const texts = nums.map((number) => plain(verses[String(number)]))
  const marked = markHostedChapter(texts, false)
  return {
    ranges: new Map(nums.map((number, index) => [number, marked.ranges[index] ?? []])),
    texts: new Map(nums.map((number, index) => [number, texts[index] ?? ''])),
  }
}

function copyWithCommand(text: string): boolean {
  const previous = document.activeElement
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.focus()
  area.select()
  area.setSelectionRange(0, text.length)
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  area.remove()
  if (previous instanceof HTMLElement) previous.focus()
  return copied
}

async function writeClipboard(text: string): Promise<void> {
  if (copyWithCommand(text)) return
  await navigator.clipboard.writeText(text)
}

function placeInView(node: HTMLElement): boolean {
  const header = document.querySelector('.top')
  const bar = document.querySelector('.actions')
  const topLimit = header instanceof HTMLElement ? header.getBoundingClientRect().bottom + 8 : 88
  const bottomLimit = bar instanceof HTMLElement ? bar.getBoundingClientRect().top - 12 : window.innerHeight - 24
  const rect = node.getBoundingClientRect()
  if (rect.top >= topLimit && rect.bottom <= bottomLimit) return false
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const band = Math.max(48, bottomLimit - topLimit)
  const top = rect.height >= band
    ? window.scrollY + rect.top - topLimit
    : window.scrollY + rect.top - topLimit - (band - rect.height) / 2
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
  return true
}

export function Reader({
  route,
  onWord,
}: {
  route: Extract<Route, { name: 'read' }>
  onWord: (ask: WordAsk) => void
}) {
  const state = useAppState()
  const voice = useVoice()
  const esvToken = useEsvToken()
  const book = bookById(route.book)
  const followRef = useRef(true)
  const programmaticRef = useRef(false)
  const scrollGen = useRef(0)

  function holdFollowLock() {
    const gen = ++scrollGen.current
    programmaticRef.current = true
    window.setTimeout(() => {
      if (scrollGen.current === gen) programmaticRef.current = false
    }, 1200)
  }
  const [file, setFile] = useState<BookFile | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(route.verse ?? 1)
  const [end, setEnd] = useState(route.verse ?? 1)
  const [settleVerse, setSettleVerse] = useState<number | null>(null)
  const [threads, setThreads] = useState<ThreadHit[]>([])
  const [xrefCount, setXrefCount] = useState(0)
  const [chapterPlaces, setChapterPlaces] = useState<Place[]>([])
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState(0)
  const [quiet, setQuiet] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [colorsOpen, setColorsOpen] = useState(false)
  const [draftColor, setDraftColor] = useState('#c4a46a')
  const [draftLabel, setDraftLabel] = useState('')
  const copiedTimer = useRef(0)
  const anchor = useRef(route.verse ?? 1)
  const dragStop = useRef<(() => void) | null>(null)
  const suppressClick = useRef(false)
  const railRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const placeKey = `${route.book}:${route.chapter}`
  const [seenPlace, setSeenPlace] = useState(placeKey)
  const [turn, setTurn] = useState<{ id: number; dir: 'next' | 'prev' } | null>(null)
  if (seenPlace !== placeKey) {
    const fromKey = seenPlace
    setSeenPlace(placeKey)
    const [fromBook, fromChapter] = fromKey.split(':')
    const fromIndex = CIRCUIT.findIndex((item) => item.book === fromBook && item.chapter === Number(fromChapter))
    const toIndex = CIRCUIT.findIndex((item) => item.book === route.book && item.chapter === route.chapter)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce && fromIndex >= 0 && toIndex >= 0) {
      setTurn({ id: (turn?.id ?? 0) + 1, dir: toIndex >= fromIndex ? 'next' : 'prev' })
    }
  }

  useEffect(() => {
    const verse = route.verse ?? 1
    setSelected(verse)
    setEnd(verse)
    anchor.current = verse
  }, [route.book, route.chapter, route.verse])

  useEffect(() => {
    setSettleVerse(selected)
    const timer = window.setTimeout(() => setSettleVerse((current) => (current === selected ? null : current)), 480)
    return () => window.clearTimeout(timer)
  }, [selected, route.book, route.chapter])

  const followMark = useFollow().following
  const followPassage = followMark?.sermon.steps[followMark.step]?.passage ?? ''
  useEffect(() => {
    if (!followPassage) return
    const parsed = parseRef(followPassage)
    if (!parsed || parsed.book !== route.book || parsed.chapter !== route.chapter) return
    setSelected(parsed.verse)
    setEnd(parsed.end)
    anchor.current = parsed.verse
  }, [followPassage, followMark?.sermonId, followMark?.step, route.book, route.chapter])

  useEffect(() => {
    if (!turn) return
    const node = pageRef.current
    if (!node) return
    const fromX = turn.dir === 'next' ? '2.2rem' : '-2.2rem'
    const animation = node.animate(
      [
        { opacity: 0, transform: `translateX(${fromX})` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 450, easing: 'ease' },
    )
    return () => animation.cancel()
  }, [turn])

  useEffect(() => {
    const rail = railRef.current
    const cell = rail?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!rail || !cell) return
    const railBox = rail.getBoundingClientRect()
    const cellBox = cell.getBoundingClientRect()
    const delta = cellBox.left + cellBox.width / 2 - (railBox.left + railBox.width / 2)
    rail.scrollBy({ left: delta, behavior: 'auto' })
  }, [route.book, route.chapter])

  useEffect(() => {
    const node = pageRef.current
    if (!node) return
    const onScroll = () => {
      const rect = node.getBoundingClientRect()
      const start = window.scrollY + rect.top
      const fits = node.offsetHeight <= window.innerHeight
      const span = Math.max(1, node.offsetHeight - window.innerHeight)
      const value = fits ? 1 : Math.min(1, Math.max(0, (window.scrollY - start) / span))
      const next = Math.round(value * 500) / 500
      if (next === progressRef.current) return
      progressRef.current = next
      setProgress(next)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [file, route.book, route.chapter])

  useEffect(() => {
    const header = document.querySelector('.top')
    if (!(header instanceof HTMLElement)) return
    const sync = () => {
      document.documentElement.style.setProperty('--read-top', `${header.getBoundingClientRect().height}px`)
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(header)
    window.addEventListener('resize', sync)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
      document.documentElement.style.removeProperty('--read-top')
    }
  }, [])

  useEffect(() => () => dragStop.current?.(), [])

  useEffect(() => {
    setPosition(route.book, route.chapter, route.verse ?? selected)
  }, [route.book, route.chapter, route.verse, selected])

  useEffect(() => {
    if (!book || state.translation === 'esv' || state.translation === 'niv') return
    let live = true
    setPending(true)
    setError('')
    loadBook(state.translation, book.id)
      .then((next) => {
        if (!live) return
        setFile(next)
        setPending(false)
      })
      .catch(() => {
        if (!live) return
        setFile(null)
        setPending(false)
        setError('This book is not on the device.')
      })
    return () => {
      live = false
    }
  }, [book, state.translation])

  useEffect(() => {
    if (!book || (state.translation !== 'esv' && state.translation !== 'niv')) return
    let live = true
    setPending(true)
    setError('')
    loadChapter(state.translation, book.id, route.chapter)
      .then((next) => {
        if (!live) return
        setFile(next)
        setPending(false)
      })
      .catch((err: unknown) => {
        if (!live) return
        setFile(null)
        setPending(false)
        setError(err instanceof EsvError || err instanceof NivError ? err.message : 'This chapter did not load.')
      })
    return () => {
      live = false
    }
  }, [book, state.translation, route.chapter, esvToken])

  useEffect(() => {
    let live = true
    const id = verseId(route.book, route.chapter, selected)
    threadsForVerse(id).then((hits) => {
      if (live) setThreads(hits)
    }).catch(() => {
      if (live) setThreads([])
    })
    loadXrefs(route.book).then((refs) => {
      if (!live) return
      const groups = refs[`${route.chapter}:${selected}`] ?? []
      setXrefCount(groups.reduce((sum, group) => sum + group.v.length, 0))
    })
    return () => {
      live = false
    }
  }, [route.book, route.chapter, selected])

  useEffect(() => {
    if (getVoice().status === 'playing') return
    const node = document.getElementById(`v${selected}`)
    if (route.verse) node?.scrollIntoView({ block: 'center' })
  }, [file, route.verse, selected])

  useEffect(() => {
    if (voice.status !== 'playing' || voice.verse == null) return
    if (voice.book !== route.book || voice.chapter !== route.chapter) return
    setSelected(voice.verse)
    setEnd(voice.verse)
  }, [voice.status, voice.verse, voice.book, voice.chapter, route.book, route.chapter])

  useEffect(() => {
    followRef.current = true
    let timer = 0
    const onScroll = () => {
      if (programmaticRef.current) return
      if (getVoice().status !== 'playing') return
      followRef.current = false
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        followRef.current = true
        const snap = getVoice()
        if (snap.status !== 'playing' || snap.verse == null) return
        if (snap.book !== route.book || snap.chapter !== route.chapter) return
        const node = document.querySelector(`#v${snap.verse} .spoken`) ?? document.getElementById(`v${snap.verse}`)
        if (!(node instanceof HTMLElement) || !placeInView(node)) return
        holdFollowLock()
      }, 3500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [route.book, route.chapter])

  useEffect(() => {
    if (voice.status !== 'playing' || voice.verse == null) return
    if (voice.book !== route.book || voice.chapter !== route.chapter) return
    if (!followRef.current) return
    const node = document.querySelector(`#v${voice.verse} .spoken`) ?? document.getElementById(`v${voice.verse}`)
    if (!(node instanceof HTMLElement) || !placeInView(node)) return
    holdFollowLock()
  }, [voice.status, voice.book, voice.chapter, voice.verse, voice.charIndex, file, route.book, route.chapter])

  useEffect(() => {
    const chapter = file?.chapters[String(route.chapter)]
    if (!chapter) {
      setChapterPlaces([])
      return
    }
    let live = true
    const text = Object.values(chapter).map((verse) => plain(verse)).join('\n')
    loadPlaces()
      .then((list) => {
        if (live) setChapterPlaces(placesInText(list, text))
      })
      .catch(() => {
        if (live) setChapterPlaces([])
      })
    return () => {
      live = false
    }
  }, [file, route.chapter])

  useEffect(() => {
    return () => window.clearTimeout(copiedTimer.current)
  }, [])

  useEffect(() => {
    const chapter = file?.chapters[String(route.chapter)]
    if (!book || !chapter) return
    const from = selected || Object.keys(chapter).map(Number).sort((a, b) => a - b)[0] || 1
    const script = Object.keys(chapter)
      .map(Number)
      .filter((number) => Number.isFinite(number) && number >= from)
      .sort((a, b) => a - b)
      .slice(0, 8)
      .map((number) => {
        const id = verseId(book.id, route.chapter, number)
        return {
          key: id,
          label: formatRef(id),
          text: plain(chapter[String(number)]),
          book: book.id,
          chapter: route.chapter,
          verse: number,
          href: `/read/${book.id}/${route.chapter}/${number}`,
        }
      })
      .filter((line) => line.text.trim())
    if (script.length) warmVoiceLines(script)
  }, [book, file, route.chapter, selected, state.translation])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const next = neighbor(route.book, route.chapter, event.key === 'ArrowRight' ? 1 : -1)
      if (next) go(`/read/${next.book}/${next.chapter}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route.book, route.chapter])

  useEffect(() => {
    const node = toolsRef.current
    if (!node) return
    const apply = () => document.documentElement.style.setProperty('--tools-h', `${node.offsetHeight + 8}px`)
    apply()
    const watch = new ResizeObserver(apply)
    watch.observe(node)
    return () => {
      watch.disconnect()
      document.documentElement.style.setProperty('--tools-h', '0px')
    }
  }, [book?.id, quiet, toolsOpen, voice.status])

  useEffect(() => {
    if (!colorsOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [colorsOpen])

  const wasIdle = useRef(true)
  useEffect(() => {
    const idle = voice.status === 'idle'
    if (!idle && wasIdle.current) {
      setToolsOpen(false)
      setColorsOpen(false)
    }
    wasIdle.current = idle
  }, [voice.status])

  useEffect(() => {
    const onVoiceMore = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      if (detail?.open) {
        setToolsOpen(false)
        setColorsOpen(false)
      }
    }
    window.addEventListener('scripture:voice-more', onVoiceMore)
    return () => window.removeEventListener('scripture:voice-more', onVoiceMore)
  }, [])

  const hostedPack = useHostedGod(
    state.translation === 'esv' || state.translation === 'niv' ? state.translation : null,
    book?.id ?? null,
    route.chapter,
  )

  if (!book) return <p>That book is not in the canon.</p>
  const verses = file?.chapters[String(route.chapter)]
  const numbers = verses ? Object.keys(verses).map(Number).sort((a, b) => a - b) : []
  const hosted = state.translation === 'esv' || state.translation === 'niv'
  const divine = useDivineBook(hosted ? null : state.translation, book?.id ?? null)
  const interimPack = hosted && verses ? interimHosted(verses) : null
  const godPack = hostedPack ?? interimPack
  const max = numbers[numbers.length - 1] ?? 1
  const prev = neighbor(book.id, route.chapter, -1)
  const next = neighbor(book.id, route.chapter, 1)

  function move(step: -1 | 1) {
    const target = neighbor(book!.id, route.chapter, step)
    if (target) go(`/read/${target.book}/${target.chapter}`)
  }

  function pick(number: number, extend: boolean) {
    if (extend) {
      const start = Math.min(anchor.current, number)
      const last = Math.max(anchor.current, number)
      setSelected(start)
      setEnd(last)
    } else {
      anchor.current = number
      setSelected(number)
      setEnd(number)
    }
    setPosition(book!.id, route.chapter, number)
  }

  function beginDrag(number: number, event: React.PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    suppressClick.current = true
    pick(number, event.shiftKey)
    let last = number
    const movePointer = (ev: PointerEvent) => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)
      const node = hit?.closest<HTMLElement>('[data-verse]')
      const nextVerse = Number(node?.dataset.verse)
      if (!nextVerse || nextVerse === last) return
      last = nextVerse
      pick(nextVerse, true)
    }
    const up = () => {
      window.removeEventListener('pointermove', movePointer)
      window.removeEventListener('pointerup', up)
      articleRef.current?.classList.remove('dragging')
      dragStop.current = null
    }
    dragStop.current?.()
    articleRef.current?.classList.add('dragging')
    dragStop.current = up
    window.addEventListener('pointermove', movePointer)
    window.addEventListener('pointerup', up)
  }

  const here = voice.book === book?.id && voice.chapter === route.chapter
  const listening = voice.status !== 'idle'
  const toolsCollapsed = (quiet || listening) && !toolsOpen

  function openTools() {
    setToolsOpen(true)
    setVoiceMoreOpen(false)
    setToolsChromeOpen(true)
  }

  function closeTools() {
    setToolsOpen(false)
    setColorsOpen(false)
    setToolsChromeOpen(false)
  }

  function readAloud() {
    if (!book) return
    setToolsOpen(false)
    setColorsOpen(false)
    if (voice.status === 'playing' && here) {
      pauseVoice()
      return
    }
    if (voice.status === 'paused' && here && voice.verse === selected) {
      resumeVoice()
      return
    }
    void startVoice({
      translation: state.translation,
      book: book.id,
      chapter: route.chapter,
      from: selected,
      to: end > selected ? end : undefined,
      verses,
    })
  }

  const playingHere = here && voice.status === 'playing'
  const resumeHere = here && voice.status === 'paused' && voice.verse === selected
  const listenDisabled = voice.status === 'idle' && !file
  const paletteFull = state.palette.length >= PALETTE_CAP

  function addColor(event: FormEvent) {
    event.preventDefault()
    if (!addInk(draftColor, draftLabel)) return
    setDraftLabel('')
  }

  function toggleQuiet() {
    setQuiet((on) => !on)
    setToolsOpen(false)
    setColorsOpen(false)
  }

  function memorize() {
    if (!verses) return
    const ids: string[] = []
    const lines: string[] = []
    const last = Math.min(max, Math.max(selected, end))
    for (let verse = selected; verse <= last; verse += 1) {
      const text = plain(verses[String(verse)])
      if (!text) continue
      ids.push(verseId(book!.id, route.chapter, verse))
      lines.push(text)
    }
    if (!ids.length) return
    if (!addMemory(state.translation, ids, lines.join(' '))) {
      setError(memoryLimitNote(state.translation))
      return
    }
    go('/memorize')
  }

  const lastVerse = Math.min(max, Math.max(selected, end))
  const rangeIds: string[] = []
  for (let verse = selected; verse <= lastVerse; verse += 1) {
    if (plain(verses?.[String(verse)])) rangeIds.push(verseId(book.id, route.chapter, verse))
  }
  const rangeInk = rangeIds.length && rangeIds.every((id) => state.highlights[id] === state.highlights[rangeIds[0]])
    ? state.highlights[rangeIds[0]]
    : undefined
  const rangeMarked = rangeIds.length > 0 && rangeIds.every((id) => state.marks.includes(id))

  async function copyPassage() {
    if (!verses) return
    const lines: string[] = []
    for (let verse = selected; verse <= lastVerse; verse += 1) {
      const text = plain(verses[String(verse)])
      if (!text) continue
      lines.push(`${bookName(book!.id)} ${route.chapter}:${verse} ${text}`)
    }
    if (!lines.length) return
    const body = `${lines.join('\n')}\n${translationShort(state.translation)}`
    try {
      await writeClipboard(body)
      setError('')
      setCopied(true)
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('The passage could not be copied.')
    }
  }

  return (
    <article
      ref={articleRef}
      className={['reading', 'scripture', pending && file ? 'is-pending' : ''].filter(Boolean).join(' ')}
      onTouchStart={(event) => {
        const target = event.target
        if (target instanceof Element && target.closest('.chapter-rail, .vn, .actions, .ink-panel')) {
          delete event.currentTarget.dataset.x
          delete event.currentTarget.dataset.y
          return
        }
        const touch = event.changedTouches[0]
        event.currentTarget.dataset.x = String(touch.clientX)
        event.currentTarget.dataset.y = String(touch.clientY)
      }}
      onTouchEnd={(event) => {
        const x = Number(event.currentTarget.dataset.x || 0)
        const y = Number(event.currentTarget.dataset.y || 0)
        if (!x && !y) return
        const touch = event.changedTouches[0]
        const dx = touch.clientX - x
        const dy = touch.clientY - y
        if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
      }}
    >
      <div className="read-progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div ref={pageRef}>
      <FollowBar />
      <p className="kicker">{book.testament === 'OT' ? 'Old Testament' : 'New Testament'} · {translationShort(state.translation)}</p>
      <div className="chapter-head">
        <button type="button" className="icon-btn" onClick={() => move(-1)} disabled={!prev} aria-label="Previous chapter">‹</button>
        <h1>{bookName(book.id)} {route.chapter}</h1>
        <button type="button" className="icon-btn" onClick={() => move(1)} disabled={!next} aria-label="Next chapter">›</button>
      </div>
      <div className="chapter-rail" ref={railRef} aria-label="Chapters">
        {Array.from({ length: book.chapters }, (_, index) => index + 1).map((chapter) => {
          const read = isChapterRead(book.id, chapter)
          const current = chapter === route.chapter
          return (
            <button
              key={chapter}
              type="button"
              className={current ? 'on' : ''}
              aria-current={current ? 'page' : undefined}
              onClick={() => go(`/read/${book.id}/${chapter}`)}
            >
              {chapter}
              {read ? <i /> : null}
            </button>
          )
        })}
      </div>
      <SettingStrip bookId={book.id} chapter={route.chapter} />
      {chapterPlaces.length ? (
        <div className="chips" aria-label="Places in this chapter">
          {chapterPlaces.map((place) => (
            <button key={place.id} type="button" className="chip" onClick={() => go(`/places/${place.id}`)}>
              {place.name}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="miss">{error}</p> : null}
      {!file && pending && !error ? (
        <div className="reading-skeleton" aria-busy="true" aria-label="Opening the chapter">
          <i /><i /><i /><i /><i />
        </div>
      ) : null}
      {numbers.map((number) => {
        const text = verses?.[String(number)]
        if (!text) return null
        const on = number >= selected && number <= Math.max(selected, end)
        const speaking = voice.status !== 'idle' && voice.book === book.id && voice.chapter === route.chapter && voice.verse === number
        const inkId = state.highlights[verseId(book.id, route.chapter, number)]
        const ink = inkId ? state.palette.find((item) => item.id === inkId) : undefined
        const hex = ink ? inkHex(ink.color) : null
        return (
          <div key={number} id={`v${number}`} data-verse={number} className={['verse', number === numbers[0] ? 'first' : '', on ? 'on' : '', speaking ? 'speaking' : '', settleVerse === number ? 'settle' : '', hex ? 'inked' : ''].filter(Boolean).join(' ')} style={hex ? { '--ink': hex } as CSSProperties : undefined} aria-current={speaking ? 'location' : undefined}>
            <button
              type="button"
              className="vn"
              onClick={(event) => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                pick(number, event.shiftKey)
              }}
              onPointerDown={(event) => beginDrag(number, event)}
            >
              {number}
            </button>
            <p className="vt" onClick={(event) => pick(number, event.shiftKey)}>
              <VerseText
                verse={text}
                dropCap={number === numbers[0]}
                spokenAt={speaking ? voice.charIndex : null}
                god={hosted ? hostedVerseGod(godPack, number, plain(text)) : verseGod(divine, route.chapter, number)}
                onWord={(surface, strongs) => {
                  pick(number, false)
                  onWord({ surface, strongs, ref: verseId(book.id, route.chapter, number) })
                }}
              />
            </p>
          </div>
        )
      })}
      {state.translation === 'esv' && file ? <EsvNotice /> : null}
      {state.translation === 'niv' && file ? <NivNotice /> : null}
      <div className="pager">
        <button type="button" onClick={() => move(-1)} disabled={!prev}>{prev ? `${bookName(prev.book)} ${prev.chapter}` : 'Start'}</button>
        <button type="button" className={isChapterRead(book.id, route.chapter) ? 'choice gold' : ''} onClick={() => markChapterRead(book.id, route.chapter)}>
          {isChapterRead(book.id, route.chapter) ? 'Chapter read' : 'Mark chapter read'}
        </button>
        <button type="button" onClick={() => move(1)} disabled={!next}>{next ? `${bookName(next.book)} ${next.chapter}` : 'End'}</button>
      </div>
      </div>
      <div ref={toolsRef} className={toolsCollapsed ? 'actions quiet-bar' : 'actions'} aria-label="Verse actions">
        {toolsCollapsed ? (
          <>
            {listening ? null : (
              <button type="button" className="choice gold" onClick={readAloud} disabled={listenDisabled} aria-label={playingHere ? 'Pause reading' : here && voice.status === 'paused' ? 'Resume reading' : 'Read aloud'}>
                {playingHere ? 'Pause' : resumeHere ? 'Resume' : 'Read aloud'}
              </button>
            )}
            <button type="button" className="choice gold" onClick={openTools}>Tools</button>
          </>
        ) : (
          <>
            {colorsOpen ? (
              <div className="ink-panel" role="dialog" aria-label="Highlight colors">
                <div className="ink-panel-head">
                  <strong>Highlight colors</strong>
                  <button type="button" className="text-btn" onClick={() => setColorsOpen(false)}>Close</button>
                </div>
                <form className="ink-add" onSubmit={addColor}>
                  <input type="color" value={draftColor} aria-label="New highlight color" onChange={(event) => setDraftColor(event.target.value)} />
                  <input
                    type="text"
                    value={draftLabel}
                    maxLength={INK_LABEL_CAP}
                    placeholder="Label"
                    aria-label="Label for the new color"
                    onChange={(event) => setDraftLabel(event.target.value)}
                  />
                  <button type="submit" className="choice gold" disabled={paletteFull}>Add</button>
                </form>
                {paletteFull ? <p className="quiet">Sixteen colors is the limit. Remove one you added to mix another.</p> : null}
                <ul className="ink-edits">
                  {state.palette.map((ink) => (
                    <li key={ink.id} className="ink-edit">
                      <input
                        type="color"
                        value={ink.color}
                        aria-label={ink.label ? `Color for ${ink.label}` : `Color for ${ink.id}`}
                        onChange={(event) => updateInk(ink.id, { color: event.target.value })}
                      />
                      <input
                        type="text"
                        value={ink.label}
                        maxLength={INK_LABEL_CAP}
                        placeholder="Label"
                        aria-label={ink.label ? `Label for ${ink.label}` : `Label for ${ink.id}`}
                        onChange={(event) => updateInk(ink.id, { label: event.target.value })}
                      />
                      {ink.builtin ? null : (
                        <button type="button" className="text-btn" onClick={() => removeInk(ink.id)}>Remove</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="tools-head">
              <span className="quiet tool-ref">{bookName(book.id)} {route.chapter}:{selected}{end > selected ? `–${end}` : ''}</span>
              {quiet || listening ? (
                <button type="button" className="choice gold tools-hide" onClick={closeTools}>Hide</button>
              ) : null}
            </div>
            <div className="inks" role="group" aria-label="Highlight">
              {state.palette.map((ink) => {
                const hex = inkHex(ink.color)
                if (!hex) return null
                const pressed = rangeInk === ink.id
                return (
                  <button
                    key={ink.id}
                    type="button"
                    className={['swatch', ink.label ? 'pill' : '', pressed ? 'on' : ''].filter(Boolean).join(' ')}
                    style={ink.label ? undefined : { background: hex }}
                    aria-label={ink.label ? `Highlight ${ink.label}` : `Highlight ${ink.id}`}
                    aria-pressed={pressed}
                    onClick={() => setHighlight(rangeIds, ink.id)}
                  >
                    {ink.label ? <><i style={{ background: hex }} aria-hidden="true" />{ink.label}</> : null}
                  </button>
                )
              })}
              <button type="button" className="swatch add" aria-expanded={colorsOpen} aria-label="Add a highlight color" onClick={() => setColorsOpen((open) => !open)}>+</button>
            </div>
            <div className="tool-row">
              <button type="button" className="choice gold" onClick={readAloud} disabled={listenDisabled} aria-label={playingHere ? 'Pause reading' : here && voice.status === 'paused' ? 'Resume reading' : 'Read aloud'}>
                {playingHere ? 'Pause' : resumeHere ? 'Resume' : 'Read aloud'}
              </button>
              <label className="through">
                Through
                <input
                  type="number"
                  min={selected}
                  max={max}
                  value={Math.max(selected, end)}
                  aria-label="Highlight through verse"
                  onChange={(event) => setEnd(Number(event.target.value) || selected)}
                />
              </label>
              <button type="button" className={rangeMarked ? 'choice gold' : 'choice'} onClick={() => toggleMarks(rangeIds)}>
                {rangeMarked ? 'Marked' : 'Mark'}
              </button>
              <button type="button" className="choice" onClick={() => void copyPassage()}>{copied ? 'Copied' : 'Copy'}</button>
              <button type="button" className="choice" onClick={() => go(`/study/${book.id}/${route.chapter}/${selected}`)}>Study</button>
              <button type="button" className="choice" onClick={() => go(`/refs/${verseId(book.id, route.chapter, selected)}`)}>
                Links{xrefCount ? ` ${xrefCount}` : ''}
              </button>
              <button type="button" className="choice gold" onClick={memorize}>Memory</button>
              <button type="button" className={quiet ? 'choice gold' : 'choice'} aria-pressed={quiet} onClick={toggleQuiet}>Quiet</button>
              {threads[0] ? (
                <button type="button" className="choice" onClick={() => go(threads.length === 1 ? `/prophecy/thread/${threads[0].id}` : `/prophecy/verse/${verseId(book.id, route.chapter, selected)}`)}>
                  {threads.length === 1 ? threads[0].title : 'Prophecy'}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </article>
  )
}
