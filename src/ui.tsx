import { useEffect, useRef, useState } from 'react'
import { formatRef, parseRef } from './lib/canon'
import { lookupEnglish, type DictEntry } from './lib/dictionary'
import { godSlices, loadDivine, markDivine, markHostedChapter, verseGod, type DivineBook, type Range } from './lib/divine'
import { isHosted, loadChapter, loadGloss, loadOriginal, plain, readPassage, translationName, type Gloss, type OriginalWord, type Translation, type Verse } from './lib/bible'
import { setEsvToken, useEsvToken } from './lib/esv'
import { loadPlaces, matchPlace, type Place } from './lib/places'
import { go } from './lib/router'
import {
  nextTicket,
  pauseVoice,
  resumeVoice,
  setSleep,
  setVoiceName,
  setVoiceRate,
  skipVoice,
  startScript,
  stopVoice,
  toggleVoice,
  toggleVoiceFlow,
  useVoice,
  warmVoiceLines,
  VOICE_RATES,
  type ScriptLine,
  type SleepChoice,
  type VoiceSnapshot,
} from './lib/speech'
import { STUDIO_VOICES, studioChoice } from './lib/studioVoice'
import { GrammarBlock, WordLesson, lessonLanguage } from './teach'

export type WordAsk = { surface: string; strongs: string[]; ref?: string }

export function EsvNotice({ full = false }: { full?: boolean }) {
  if (full) {
    return (
      <p className="colophon">
        Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language. Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible.{' '}
        <a href="https://www.esv.org/" target="_blank" rel="noreferrer">www.esv.org</a>
      </p>
    )
  }
  return (
    <p className="quiet">
      ESV® · <a href="https://www.esv.org/" target="_blank" rel="noreferrer">www.esv.org</a>
    </p>
  )
}

export function NivNotice({ full = false }: { full?: boolean }) {
  if (full) {
    return (
      <p className="colophon">
        Scripture quotations marked “NIV” are from The Holy Bible, New International Version® NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission of Biblica, Inc.® All rights reserved worldwide.
      </p>
    )
  }
  return (
    <p className="quiet">
      NIV® · <a href="https://www.biblica.com/" target="_blank" rel="noreferrer">Biblica</a>
    </p>
  )
}

export function EsvKeyBar() {
  const token = useEsvToken()
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  if (token && !editing) {
    return (
      <div className="esv-bar">
        <p>
          ESV is requested from Crossway one chapter at a time.{' '}
          <a href="https://www.esv.org/" target="_blank" rel="noreferrer">www.esv.org</a>
        </p>
        <button type="button" className="text-btn" onClick={() => setEditing(true)}>Key</button>
      </div>
    )
  }
  return (
    <form
      className="esv-bar"
      onSubmit={(event) => {
        event.preventDefault()
        if (!draft.trim()) return
        setEsvToken(draft)
        setDraft('')
        setEditing(false)
      }}
    >
      <p>
        Create a free key at <a href="https://api.esv.org/" target="_blank" rel="noreferrer">api.esv.org</a> and paste it here. It stays on this device.
      </p>
      <input
        type="password"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="ESV API key"
        aria-label="ESV API key"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="choice" disabled={!draft.trim()}>Save key</button>
      {token ? (
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            setEsvToken('')
            setDraft('')
            setEditing(true)
          }}
        >
          Remove key
        </button>
      ) : null}
    </form>
  )
}

function spokenHere(offset: number, value: string, mark: number | null | undefined): boolean {
  return mark != null && mark >= offset && mark < offset + value.length && /[A-Za-z0-9]/.test(value)
}

function tone(god: boolean, marked: boolean, extra = ''): string | undefined {
  const name = [extra, god ? 'god' : '', marked ? 'spoken' : ''].filter(Boolean).join(' ')
  return name || undefined
}

function phraseHits(text: string, phrase?: string): [number, number][] {
  if (!phrase) return []
  const hay = text.toLowerCase()
  const needle = phrase.toLowerCase()
  const hits: [number, number][] = []
  let from = 0
  while (needle && from < hay.length) {
    const at = hay.indexOf(needle, from)
    if (at < 0) break
    const end = at + needle.length
    const before = at > 0 ? text[at - 1] : ''
    const after = text[end] ?? ''
    if (!/[A-Za-z]/.test(before) && !/[A-Za-z]/.test(after)) hits.push([at, end])
    from = at + needle.length
  }
  return hits
}

function overlaps(offset: number, length: number, hits: [number, number][]): boolean {
  return hits.some(([start, end]) => offset < end && offset + length > start)
}

function DroppedWord({
  value,
  marked,
  god,
  lit,
  onActivate,
}: {
  value: string
  marked: boolean
  god: boolean
  lit?: boolean
  onActivate: () => void
}) {
  const match = value.match(/^([^A-Za-z]*)([A-Za-z])([\s\S]*)$/)
  const wordClass = tone(god, marked, lit ? 'word lit' : 'word') ?? 'word'
  const activate = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    onActivate()
  }
  if (!match) {
    return (
      <button type="button" className={wordClass} onClick={activate}>
        {value}
      </button>
    )
  }
  const [, prefix, letter, rest] = match
  return (
    <>
      {prefix ? <span className={tone(god, marked)}>{prefix}</span> : null}
      <button type="button" className={`${wordClass} drop`} onClick={activate}>{letter}</button>
      {rest ? (
        <button type="button" className={wordClass} onClick={activate}>{rest}</button>
      ) : null}
    </>
  )
}

export function VerseText({
  verse,
  onWord,
  spokenAt = null,
  dropCap = false,
  god,
  activeStrongs,
  phrase,
}: {
  verse: Verse
  onWord?: (surface: string, strongs: string[]) => void
  spokenAt?: number | null
  dropCap?: boolean
  god?: Range[]
  activeStrongs?: string[]
  phrase?: string
}) {
  let offset = 0
  let dropped = false
  const hits = typeof verse === 'string' ? phraseHits(verse, phrase) : phraseHits(verse.map((token) => token[0]).join(''), phrase)
  if (typeof verse === 'string') {
    const parts = verse.split(/([A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*)/g)
    return (
      <>
        {parts.map((part, index) => {
          const start = offset
          const marked = spokenHere(start, part, spokenAt)
          const slices = godSlices(part, start, god)
          offset += part.length
          const word = /^[A-Za-z]/.test(part)
          const lit = word && overlaps(start, part.length, hits)
          const drop = dropCap && word && !dropped
          if (drop) dropped = true
          if (drop && slices.length === 1) {
            return <DroppedWord key={index} value={part} marked={marked} god={slices[0].god} lit={lit} onActivate={() => onWord?.(part, [])} />
          }
          return slices.map((slice, sliceIndex) => {
            const key = `${index}-${sliceIndex}`
            if (drop && sliceIndex === 0) {
              return <DroppedWord key={key} value={slice.text} marked={marked} god={slice.god} lit={lit} onActivate={() => onWord?.(part, [])} />
            }
            return word ? (
              <button
                key={key}
                type="button"
                className={tone(slice.god, marked, lit ? 'word lit' : 'word')}
                onClick={(event) => {
                  event.stopPropagation()
                  onWord?.(part, [])
                }}
              >
                {slice.text}
              </button>
            ) : (
              <span key={key} className={tone(slice.god, marked, lit ? 'lit' : '')}>{slice.text}</span>
            )
          })
        })}
      </>
    )
  }
  return (
    <>
      {verse.map((token, index) => {
        const value = token[0]
        const start = offset
        const marked = spokenHere(start, value, spokenAt)
        const slices = godSlices(value, start, god)
        offset += value.length
        const strongs = token[1]?.split('+').filter(Boolean) ?? []
        const lit = Boolean(activeStrongs?.some((item) => strongs.includes(item))) || overlaps(start, value.length, hits)
        const surface = value.replace(/\s+/g, ' ').trim()
        const drop = dropCap && /[A-Za-z]/.test(value) && !dropped
        if (drop) dropped = true
        if (drop && slices.length === 1 && strongs.length) {
          return <DroppedWord key={index} value={value} marked={marked} god={slices[0].god} lit={lit} onActivate={() => onWord?.(surface, strongs)} />
        }
        if (drop && slices.length === 1) {
          const match = value.match(/^([^A-Za-z]*)([A-Za-z])([\s\S]*)$/)
          if (!match) return <span key={index} className={tone(slices[0].god, marked, lit ? 'lit' : '')}>{value}</span>
          const [, prefix, letter, rest] = match
          return (
            <span key={index} className={tone(slices[0].god, marked, lit ? 'lit' : '')}>
              {prefix}
              <span className="drop">{letter}</span>
              {rest}
            </span>
          )
        }
        return slices.map((slice, sliceIndex) => {
          const key = `${index}-${sliceIndex}`
          if (!strongs.length) return <span key={key} className={tone(slice.god, marked, lit ? 'lit' : '')}>{slice.text}</span>
          return (
            <button
              key={key}
              type="button"
              className={tone(slice.god, marked, lit ? 'word lit' : 'word')}
              onClick={(event) => {
                event.stopPropagation()
                onWord?.(surface, strongs)
              }}
            >
              {slice.text}
            </button>
          )
        })
      })}
    </>
  )
}

export function SpokenText({ text, mark, god, phrase }: { text: string; mark: number | null; god?: Range[]; phrase?: string }) {
  const hits = phraseHits(text, phrase)
  let offset = 0
  const parts = text.split(/([A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*)/g)
  return (
    <>
      {parts.map((part, index) => {
        const start = offset
        const marked = mark != null && mark >= start && mark < start + part.length && /[A-Za-z0-9]/.test(part)
        const lit = overlaps(start, part.length, hits)
        const slices = godSlices(part, start, god)
        offset += part.length
        return slices.map((slice, sliceIndex) => (
          <span key={`${index}-${sliceIndex}`} className={tone(slice.god, marked, lit ? 'lit' : '')}>{slice.text}</span>
        ))
      })}
    </>
  )
}

export type HostedPack = { ranges: Map<number, Range[]>; texts: Map<number, string> }

const openCache = new Map<string, Promise<boolean>>()
const packCache = new Map<string, Promise<HostedPack>>()
let hostedStamp = ''

function rememberStamp(stamp: string) {
  if (stamp === hostedStamp) return
  hostedStamp = stamp
  openCache.clear()
  packCache.clear()
}

function orderedChapter(file: { chapters: Record<string, Record<string, Verse>> }, chapter: number) {
  const slot = file.chapters[String(chapter)] ?? {}
  const numbers = Object.keys(slot).map(Number).filter((number) => Number.isFinite(number)).sort((a, b) => a - b)
  return { numbers, texts: numbers.map((number) => plain(slot[String(number)])) }
}

function chapterEndedOpen(translation: Translation, book: string, chapter: number, depth = 0): Promise<boolean> {
  if (chapter < 1 || depth >= 4) return Promise.resolve(false)
  const key = `${hostedStamp}/${translation}/${book}/${chapter}`
  const hit = openCache.get(key)
  if (hit) return hit
  const pending = (async () => {
    const file = await loadChapter(translation, book, chapter)
    const { texts } = orderedChapter(file, chapter)
    if (!markHostedChapter(texts, true).openDivine) return false
    if (markHostedChapter(texts, false).openDivine) return true
    if (chapter <= 1 || depth + 1 >= 4) return false
    const carried = await chapterEndedOpen(translation, book, chapter - 1, depth + 1)
    return markHostedChapter(texts, carried).openDivine
  })().catch((error: unknown) => {
    openCache.delete(key)
    throw error
  })
  openCache.set(key, pending)
  return pending
}

export function loadHostedPack(translation: Translation, book: string, chapter: number): Promise<HostedPack> {
  const key = `${hostedStamp}/${translation}/${book}/${chapter}`
  const hit = packCache.get(key)
  if (hit) return hit
  const pending = (async () => {
    const carried = chapter > 1 ? await chapterEndedOpen(translation, book, chapter - 1).catch(() => false) : false
    const file = await loadChapter(translation, book, chapter)
    const { numbers, texts } = orderedChapter(file, chapter)
    const marked = markHostedChapter(texts, carried)
    return {
      ranges: new Map(numbers.map((number, index) => [number, marked.ranges[index] ?? []])),
      texts: new Map(numbers.map((number, index) => [number, texts[index] ?? ''])),
    }
  })().catch((error: unknown) => {
    packCache.delete(key)
    throw error
  })
  packCache.set(key, pending)
  return pending
}

export function hostedVerseGod(pack: HostedPack | null, verse: number, text: string): Range[] {
  const stored = pack?.texts.get(verse)
  if (pack && stored === text) return pack.ranges.get(verse) ?? []
  return markDivine([text], true)[0] ?? []
}

export function useHostedGod(translation: Translation | null, book: string | null, chapter: number | null): HostedPack | null {
  const token = useEsvToken()
  const [pack, setPack] = useState<HostedPack | null>(null)
  useEffect(() => {
    rememberStamp(token)
    if (!translation || !isHosted(translation) || !book || !chapter) {
      setPack(null)
      return
    }
    let live = true
    setPack(null)
    loadHostedPack(translation, book, chapter)
      .then((next) => {
        if (live) setPack(next)
      })
      .catch(() => {
        if (live) setPack(null)
      })
    return () => {
      live = false
    }
  }, [translation, book, chapter, token])
  return pack
}

export function useDivineBook(translation: Translation | null, book: string | null): DivineBook | null {
  const [file, setFile] = useState<DivineBook | null>(null)
  useEffect(() => {
    if (!translation || translation === 'esv' || translation === 'niv' || !book) {
      setFile(null)
      return
    }
    let live = true
    loadDivine(translation, book).then((next) => {
      if (live) setFile(next)
    })
    return () => {
      live = false
    }
  }, [translation, book])
  return file
}

export function GodLine({
  translation,
  id,
  text,
  mark,
}: {
  translation: Translation
  id: string
  text: string
  mark: number | null
}) {
  const parsed = parseRef(id)
  const hosted = translation === 'esv' || translation === 'niv'
  const stored = useDivineBook(hosted ? null : translation, parsed?.book ?? null)
  const pack = useHostedGod(hosted ? translation : null, parsed?.book ?? null, parsed?.chapter ?? null)
  const god = hosted ? hostedVerseGod(pack, parsed?.verse ?? 0, text) : parsed ? verseGod(stored, parsed.chapter, parsed.verse) : []
  return <SpokenText text={text} mark={mark} god={god} />
}

export function verseMark(voice: VoiceSnapshot, id: string, translation?: Translation | null): number | null {
  if (voice.status === 'idle') return null
  if (translation && voice.translation && voice.translation !== translation) return null
  if (voice.lineKey === id) return voice.charIndex
  const parsed = parseRef(id)
  if (!parsed || parsed.end !== parsed.verse) return voice.lineKey === id ? voice.charIndex : null
  if (voice.book === parsed.book && voice.chapter === parsed.chapter && voice.verse === parsed.verse) return voice.charIndex
  return null
}

export async function verseScripts(ids: string[], translation: Translation): Promise<ScriptLine[]> {
  const groups = await Promise.all(ids.map((item) => readPassage(translation, item)))
  const lines: ScriptLine[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    for (const row of group) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      const parsed = parseRef(row.id)
      lines.push({
        key: row.id,
        label: formatRef(row.id),
        text: row.text,
        book: parsed?.book,
        chapter: parsed?.chapter,
        verse: parsed?.verse,
        href: parsed ? `/read/${parsed.book}/${parsed.chapter}/${parsed.verse}` : undefined,
      })
    }
  }
  return lines
}

export function ListenButton({
  scriptKey,
  title,
  lines,
  label = 'Listen',
  className = 'text-btn',
  follow = false,
  translation = null,
}: {
  scriptKey: string
  title: string
  lines: ScriptLine[] | (() => Promise<ScriptLine[]>)
  label?: string
  className?: string
  follow?: boolean
  translation?: Translation | null
}) {
  const voice = useVoice()
  const [busy, setBusy] = useState(false)
  const mine = voice.scriptKey === scriptKey && voice.status !== 'idle'
  const text = mine && voice.status === 'playing' ? 'Pause' : mine && voice.status === 'paused' ? 'Resume' : label
  const empty = Array.isArray(lines) && !lines.some((line) => line.text.trim())

  const warmKey = Array.isArray(lines)
    ? `${scriptKey}\n${lines.map((line) => line.text).join('\n').slice(0, 480)}`
    : ''

  useEffect(() => {
    if (!warmKey || empty || !Array.isArray(lines)) return
    warmVoiceLines(lines)
  }, [warmKey, empty])

  if (!voice.supported) return null

  async function press() {
    if (mine && voice.status === 'playing') {
      pauseVoice()
      return
    }
    if (mine && voice.status === 'paused') {
      resumeVoice()
      return
    }
    const claim = nextTicket()
    setBusy(true)
    try {
      const ready = typeof lines === 'function' ? await lines() : lines
      await startScript({ key: scriptKey, title, lines: ready, follow, translation, ticket: claim })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={mine ? `${className} gold` : className}
      onClick={() => void press()}
      disabled={busy || empty}
      aria-pressed={mine && voice.status === 'playing'}
    >
      {busy ? 'Opening…' : text}
    </button>
  )
}

function lineFromRow(row: { id: string; text: string }): ScriptLine {
  const parsed = parseRef(row.id)
  return {
    key: row.id,
    label: formatRef(row.id),
    text: row.text,
    book: parsed?.book,
    chapter: parsed?.chapter,
    verse: parsed?.verse,
    href: parsed ? `/read/${parsed.book}/${parsed.chapter}/${parsed.verse}` : undefined,
  }
}

export function VerseQuote({ id, translation }: { id: string; translation: Translation }) {
  const [rows, setRows] = useState<{ id: string; text: string; translation: Translation }[]>([])
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let live = true
    setMissing(false)
    readPassage(translation, id).then((next) => {
      if (!live) return
      setRows(next)
      setMissing(next.length === 0)
    })
    return () => {
      live = false
    }
  }, [id, translation])
  const parsed = parseRef(id)
  const voice = useVoice()
  const hosted = translation === 'esv' || translation === 'niv'
  const stored = useDivineBook(hosted ? null : translation, parsed?.book ?? null)
  const pack = useHostedGod(hosted ? translation : null, parsed?.book ?? null, parsed?.chapter ?? null)
  const speaking = rows.some((row) => verseMark(voice, row.id, row.translation) != null)
  const quoteLines = rows.map(lineFromRow)
  return (
    <article className={speaking ? 'quote speaking' : 'quote'}>
      <div className="quote-bar">
        <button
          type="button"
          className="ref-link"
          onClick={() => parsed && go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)}
        >
          {formatRef(id)}
        </button>
        <ListenButton
          scriptKey={`quote:${translation}:${id}`}
          title={formatRef(id)}
          lines={quoteLines}
          translation={translation}
        />
      </div>
      {rows.map((row) => {
        const rowRef = parseRef(row.id)
        const sameChapter = Boolean(rowRef && parsed && rowRef.book === parsed.book && rowRef.chapter === parsed.chapter)
        const god = row.translation === 'esv' || row.translation === 'niv'
          ? (sameChapter ? hostedVerseGod(pack, rowRef?.verse ?? 0, row.text) : markDivine([row.text], true)[0])
          : rowRef ? verseGod(stored, rowRef.chapter, rowRef.verse) : []
        return (
          <p key={row.id} className="vt">
            <SpokenText text={row.text} mark={verseMark(voice, row.id, row.translation)} god={god} />
          </p>
        )
      })}
      {missing ? <p className="quiet">This verse is not in the open edition.</p> : null}
      {!rows.length && !missing ? <p className="quiet">Opening the verse…</p> : null}
      {rows.some((row) => row.translation === 'esv') ? <EsvNotice /> : null}
      {rows.some((row) => row.translation === 'niv') ? <NivNotice /> : null}
      {rows[0] && rows[0].translation !== translation ? (
        <p className="quiet">{translationName(rows[0].translation)}</p>
      ) : null}
    </article>
  )
}

export function HitList({
  ids,
  translation,
  readKey = '',
  readTitle = 'Verses',
}: {
  ids: string[]
  translation: Translation
  readKey?: string
  readTitle?: string
}) {
  const [count, setCount] = useState(30)
  const shown = ids.slice(0, count)
  return (
    <div>
      {readKey && shown.length ? (
        <ListenButton
          scriptKey={readKey}
          title={readTitle}
          label="Read all"
          className="choice"
          translation={translation}
          lines={() => verseScripts(shown, translation)}
        />
      ) : null}
      {shown.map((id) => (
        <VerseQuote key={id} id={id} translation={translation} />
      ))}
      {count < ids.length ? (
        <button type="button" className="wide" onClick={() => setCount((value) => value + 30)}>
          More ({ids.length - count} remaining)
        </button>
      ) : null}
    </div>
  )
}

export function WordSheet({ ask, onClose }: { ask: WordAsk; onClose: () => void }) {
  const [gloss, setGloss] = useState<Record<string, Gloss>>({})
  const [entry, setEntry] = useState<DictEntry | null>(null)
  const [dictState, setDictState] = useState<'loading' | 'ready' | 'missing' | 'offline'>('loading')
  const [place, setPlace] = useState<Place | null>(null)
  const [lessonWords, setLessonWords] = useState<OriginalWord[]>([])
  const [which, setWhich] = useState(0)
  const surface = ask.surface.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, '')
  const originals = ask.strongs
    .map((id) => ({ id, entry: gloss[id] }))
    .filter((item): item is { id: string; entry: Gloss } => Boolean(item.entry?.g))
  useEffect(() => {
    let live = true
    loadGloss()
      .then((next) => {
        if (live) setGloss(next)
      })
      .catch(() => {
        if (live) setGloss({})
      })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    const parsed = ask.ref ? parseRef(ask.ref) : null
    if (!parsed || !ask.strongs.length) {
      setLessonWords([])
      return
    }
    let live = true
    loadOriginal(parsed.book)
      .then((book) => {
        if (!live) return
        const verse = book.chapters[String(parsed.chapter)]?.[String(parsed.verse)] ?? []
        const wanted = new Set(ask.strongs)
        setLessonWords(verse.filter((word) => word.s && wanted.has(word.s)))
        setWhich(0)
      })
      .catch(() => {
        if (live) setLessonWords([])
      })
    return () => {
      live = false
    }
  }, [ask])
  useEffect(() => {
    if (!surface) {
      setEntry(null)
      setDictState('missing')
      return
    }
    let live = true
    setEntry(null)
    setDictState('loading')
    lookupEnglish(surface)
      .then((next) => {
        if (!live) return
        setEntry(next)
        setDictState(next ? 'ready' : 'missing')
      })
      .catch(() => {
        if (live) setDictState('offline')
      })
    return () => {
      live = false
    }
  }, [surface])
  useEffect(() => {
    if (!surface) {
      setPlace(null)
      return
    }
    let live = true
    loadPlaces()
      .then((places) => {
        if (live) setPlace(matchPlace(places, surface) ?? null)
      })
      .catch(() => {
        if (live) setPlace(null)
      })
    return () => {
      live = false
    }
  }, [surface])
  const glossWords: OriginalWord[] = originals
    .filter((item) => item.entry.l)
    .map((item) => ({ w: item.entry.l as string, m: '', s: item.id }))
  const shown = lessonWords.length ? lessonWords : glossWords
  const focus = shown[Math.min(which, Math.max(shown.length - 1, 0))]
  function searchGoogle() {
    const label = ask.ref ? formatRef(ask.ref) : ''
    const q = [surface, label, 'Bible'].filter(Boolean).join(' ')
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer')
  }
  return (
    <>
      <button type="button" className="sheet-back" aria-label="Close" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-label={surface || 'Word'}>
        <div className="sheet-scroll">
        <p className="kicker">Word</p>
        <h2>{surface || ask.surface}</h2>
        <section className="meaning">
          <p className="kicker">Meaning</p>
          {shown.length > 1 ? (
            <div className="chips">
              {shown.map((item, index) => (
                <button key={`${item.w}-${index}`} type="button" className={index === which ? 'chip on' : 'chip'} onClick={() => setWhich(index)}>
                  {item.w}
                </button>
              ))}
            </div>
          ) : null}
          {focus ? (
            <>
              <WordLesson
                word={focus}
                gloss={focus.s ? gloss[focus.s] : null}
                language={lessonLanguage(focus, ask.strongs[0] ?? '')}
              />
              <GrammarBlock morph={focus.m} />
              {ask.ref ? (
                <button
                  type="button"
                  className="text-btn gold"
                  onClick={() => {
                    const parsed = parseRef(ask.ref ?? '')
                    onClose()
                    if (parsed) go(`/study/${parsed.book}/${parsed.chapter}/${parsed.verse}`)
                  }}
                >
                  Study this verse
                </button>
              ) : null}
            </>
          ) : null}
          {ask.strongs.length > 0 && shown.length === 0 ? <p className="quiet">Opening the meaning…</p> : null}
          {ask.strongs.length === 0 && dictState === 'loading' ? <p className="quiet">Looking up the meaning…</p> : null}
          {ask.strongs.length === 0 && dictState === 'offline' ? (
            <p className="quiet">The dictionary needs a connection. Try again when you are online.</p>
          ) : null}
          {ask.strongs.length === 0 && dictState === 'missing' ? <p className="quiet">No English meaning is recorded for this word.</p> : null}
          {ask.strongs.length === 0 && entry
            ? (
              <>
                {entry.senses.map((sense) => (
                  <p key={`${sense.part}-${sense.definition}`}>
                    <span className="part">{sense.part}</span> {sense.definition}
                  </p>
                ))}
                <ListenButton
                  scriptKey={`dict:${surface}`}
                  title={surface}
                  label="Read the meaning"
                  lines={entry.senses.map((sense, index) => ({
                    key: `dict:${surface}:${index}`,
                    label: surface,
                    text: `${sense.part}. ${sense.definition}`,
                  }))}
                />
              </>
            )
            : null}
        </section>
        {ask.strongs.length > 0 && (entry || dictState === 'loading' || dictState === 'offline') ? (
          <section className="dict">
            <p className="kicker">English</p>
            {dictState === 'loading' ? <p className="quiet">Looking up the English word…</p> : null}
            {dictState === 'offline' ? <p className="quiet">The English dictionary needs a connection.</p> : null}
            {entry
              ? (
                <>
                  {entry.senses.map((sense) => (
                    <p key={`${sense.part}-${sense.definition}`}>
                      <span className="part">{sense.part}</span> {sense.definition}
                    </p>
                  ))}
                  <ListenButton
                    scriptKey={`dict:${surface}:english`}
                    title={surface}
                    label="Read the meaning"
                    lines={entry.senses.map((sense, index) => ({
                      key: `dict:${surface}:english:${index}`,
                      label: surface,
                      text: `${sense.part}. ${sense.definition}`,
                    }))}
                  />
                </>
              )
              : null}
          </section>
        ) : null}
        <div className="row">
          {surface ? (
            <button
              type="button"
              className="text-btn gold"
              onClick={() => {
                onClose()
                go(`/word/${encodeURIComponent(surface.toLowerCase())}`)
              }}
            >
              Every verse with “{surface.toLowerCase()}”
            </button>
          ) : null}
          {surface ? (
            <button type="button" className="text-btn" onClick={searchGoogle}>
              Search Google
            </button>
          ) : null}
          {place ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                onClose()
                go(`/places/${place.id}`)
              }}
            >
              See {place.name} on the map
            </button>
          ) : null}
        </div>
        </div>
      </aside>
    </>
  )
}

export function plainVerse(verse: Verse | undefined): string {
  return plain(verse)
}

const SLEEPS: { id: SleepChoice; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 15, label: '15 min' },
  { id: 30, label: '30 min' },
  { id: 'end', label: 'End' },
]

function MarkIcon({ playing }: { playing: boolean }) {
  if (playing) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.5 5h3.2v14H7.5zM13.3 5H16.5v14h-3.2z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.2v13.6l11-6.8z" />
    </svg>
  )
}

const VOICE_MORE_EVENT = 'scripture:voice-more'
const TOOLS_OPEN_EVENT = 'scripture:tools-open'

export function setVoiceMoreOpen(open: boolean) {
  window.dispatchEvent(new CustomEvent(VOICE_MORE_EVENT, { detail: { open } }))
}

export function setToolsChromeOpen(open: boolean) {
  window.dispatchEvent(new CustomEvent(TOOLS_OPEN_EVENT, { detail: { open } }))
}

export function VoiceDock() {
  const voice = useVoice()
  const [more, setMore] = useState(false)
  const dock = useRef<HTMLElement>(null)
  const wasActive = useRef(false)
  const open = voice.status !== 'idle' || Boolean(voice.error)
  const active = voice.status === 'playing' || voice.status === 'paused'

  useEffect(() => {
    if (active && !wasActive.current) setMore(false)
    wasActive.current = active
  }, [active])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(VOICE_MORE_EVENT, { detail: { open: more && open } }))
  }, [more, open])

  useEffect(() => {
    const onTools = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      if (detail?.open) setMore(false)
    }
    const onVoiceMore = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      if (detail && detail.open === false) setMore(false)
    }
    window.addEventListener(TOOLS_OPEN_EVENT, onTools)
    window.addEventListener(VOICE_MORE_EVENT, onVoiceMore)
    return () => {
      window.removeEventListener(TOOLS_OPEN_EVENT, onTools)
      window.removeEventListener(VOICE_MORE_EVENT, onVoiceMore)
    }
  }, [])

  useEffect(() => {
    const node = dock.current
    if (!open || !node) {
      document.documentElement.style.setProperty('--dock-h', '0px')
      return
    }
    const apply = () => document.documentElement.style.setProperty('--dock-h', `${node.offsetHeight + 12}px`)
    apply()
    const watch = new ResizeObserver(apply)
    watch.observe(node)
    return () => {
      watch.disconnect()
      document.documentElement.style.setProperty('--dock-h', '0px')
    }
  }, [open, more, voice.status, voice.error, voice.notice, voice.phraseWord])

  if (!open) return null
  const progress = voice.total > 0 ? Math.min(1, (voice.index + 1) / voice.total) : 0
  const place = voice.label || voice.title || 'Reading'
  const phrase = voice.phraseWord ? (
    <p className="voice-phrase">
      {voice.phraseBefore ? `${voice.phraseBefore} ` : null}
      <mark>{voice.phraseWord}</mark>
      {voice.phraseAfter ? ` ${voice.phraseAfter}` : null}
    </p>
  ) : null

  function toggleMore() {
    setMore((value) => {
      const next = !value
      if (next) setToolsChromeOpen(false)
      return next
    })
  }

  return (
    <section className={more ? 'voice-dock expanded' : 'voice-dock'} aria-label="Reading aloud" ref={dock}>
      <button type="button" className="voice-handle" aria-expanded={more} aria-label={more ? 'Hide reading controls' : 'Show reading controls'} onClick={toggleMore} />
      <div className="voice-progress" aria-hidden="true">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="sr-only" aria-live="polite">
        {voice.error || voice.notice || (voice.status === 'playing' ? `Reading ${place}` : '')}
      </div>
      <div className="voice-row">
        {voice.status === 'idle' ? (
          <button type="button" className="choice" onClick={() => stopVoice()}>Dismiss</button>
        ) : (
          <button
            type="button"
            className="voice-play"
            onClick={() => toggleVoice()}
            aria-label={voice.status === 'playing' ? 'Pause reading' : 'Resume reading'}
          >
            <MarkIcon playing={voice.status === 'playing'} />
          </button>
        )}
        <div className="voice-copy">
          <p className="voice-label">
            {place}
            {voice.total > 1 ? <span> · {voice.index + 1} of {voice.total}</span> : null}
          </p>
          <div className="voice-desk-phrase">{phrase}</div>
          {voice.notice ? <p className="quiet voice-status">{voice.notice}</p> : null}
          {voice.error ? <p className="miss">{voice.error}</p> : null}
        </div>
        {voice.status !== 'idle' ? (
          <>
            <button type="button" className="icon-btn" aria-label="Previous line" onClick={() => skipVoice(-1)}>‹</button>
            <button type="button" className="icon-btn" aria-label="Next line" onClick={() => skipVoice(1)}>›</button>
            <div className="seg voice-desk-extra" role="group" aria-label="Reading speed">
              {VOICE_RATES.map((value) => (
                <button key={value} type="button" className={voice.rate === value ? 'on' : ''} onClick={() => setVoiceRate(value)}>
                  {value}×
                </button>
              ))}
            </div>
          </>
        ) : null}
        {voice.href ? (
          <button type="button" className="choice voice-desk-extra" onClick={() => voice.href && go(voice.href)}>Open</button>
        ) : null}
        <button type="button" className="text-btn voice-toggle" aria-expanded={more} onClick={toggleMore}>
          {more ? 'Less' : 'More'}
        </button>
      </div>
      {more ? (
        <div className="voice-more">
          {phrase}
          {voice.status !== 'idle' ? (
            <div className="seg voice-mobile-extra" role="group" aria-label="Reading speed">
              {VOICE_RATES.map((value) => (
                <button key={value} type="button" className={voice.rate === value ? 'on' : ''} onClick={() => setVoiceRate(value)}>
                  {value}×
                </button>
              ))}
            </div>
          ) : null}
          {voice.href ? (
            <button type="button" className="choice voice-mobile-extra" onClick={() => voice.href && go(voice.href)}>Open</button>
          ) : null}
          <button type="button" className="choice" onClick={() => stopVoice()}>Stop</button>
          {voice.chapterMode ? (
            <button
              type="button"
              className={voice.flow ? 'choice gold' : 'choice'}
              aria-pressed={voice.flow}
              title="Keep reading into the next chapter when you are in the reader"
              onClick={() => toggleVoiceFlow()}
            >
              Flow along
            </button>
          ) : null}
          <label className="quiet voice-pick">
            Voice
            <select value={voice.voiceName} onChange={(event) => setVoiceName(event.target.value)} aria-label="Voice">
              <option value="">Automatic · Heart</option>
              <optgroup label="Studio">
                {STUDIO_VOICES.map((item) => (
                  <option key={item.id} value={studioChoice(item.id)}>{item.label}</option>
                ))}
              </optgroup>
              {voice.voices.length ? (
                <optgroup label="This device">
                  {voice.voices.map((item) => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <p className="quiet voice-note">Studio voices sound closest to a person. The first use downloads them.</p>
          <div className="seg" role="group" aria-label="Sleep">
            {SLEEPS.map((item) => (
              <button key={String(item.id)} type="button" className={voice.sleep === item.id ? 'on' : ''} onClick={() => setSleep(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
