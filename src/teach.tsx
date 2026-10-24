import { useEffect, useState } from 'react'
import type { Gloss, OriginalWord } from './lib/bible'
import { explainMorph, functionWord, lessonsFor } from './lib/grammar'
import { alphabetSize, consonants, glyphs, transliterate, type Script } from './lib/letters'
import { go } from './lib/router'
import { useVoice } from './lib/speech'
import { meetLesson, meetLetter, useAppState } from './lib/storage'
import { ListenButton, SpokenText } from './ui'

export function lessonLanguage(word: OriginalWord, hint = ''): string {
  if (word.s?.startsWith('G') || hint.startsWith('G')) return 'Greek'
  if (word.m.startsWith('A') && !word.m.startsWith('A-')) return 'Aramaic'
  if (word.m.includes('-')) return 'Greek'
  return 'Hebrew'
}

function wordScript(language: string): Script {
  return language === 'Greek' ? 'gr' : 'he'
}

function lexiconLines(gloss?: Gloss | null): { meaning: string; origin: string; extra: string } {
  const defined = gloss?.d?.trim() ?? ''
  const origin = gloss?.r?.trim() ?? ''
  if (/^figuratively\b/i.test(defined)) {
    const parts = origin.split(';').map((part) => part.trim()).filter(Boolean)
    const sense = parts.slice(1).join('; ').replace(/[;.\s]+$/, '')
    if (parts.length >= 2 && sense.length > 12 && !/^(from|a primitive|or |corresponding)\b/i.test(sense)) {
      return {
        meaning: sense,
        origin: parts[0].replace(/[;.\s]+$/, ''),
        extra: defined.replace(/[;.\s]+$/, ''),
      }
    }
  }
  return { meaning: defined, origin, extra: '' }
}

function Linked({ text }: { text: string }) {
  const bits = text.split(/([HG]\d+)/g)
  return (
    <>
      {bits.map((bit, index) => (
        /^[HG]\d+$/.test(bit) ? (
          <button key={index} type="button" className="jump" onClick={() => go(`/strong/${bit}`)}>{bit}</button>
        ) : (
          <span key={index}>{bit}</span>
        )
      ))}
    </>
  )
}

const introduced = new Set<string>()

export function LessonCards({ ids }: { ids: string[] }) {
  const school = useAppState().school
  const voice = useVoice()
  const key = ids.join('|')
  const [open, setOpen] = useState<string[]>(() => ids.filter((id) => introduced.has(id)))
  const [extra, setExtra] = useState('')
  useEffect(() => {
    const novel = ids.filter((id) => !school.lessons.includes(id))
    novel.forEach((id) => introduced.add(id))
    novel.forEach(meetLesson)
    setOpen(ids.filter((id) => introduced.has(id)))
    setExtra('')
  }, [key])
  const lessons = lessonsFor(ids)
  if (!lessons.length) return null
  return (
    <div className="lessons">
      {lessons.map((lesson) => {
        const shown = open.includes(lesson.id) || extra === lesson.id
        return shown ? (
          <div key={lesson.id} className="lesson">
            <p className="kicker">{lesson.title}</p>
            <p>
              <SpokenText text={lesson.body} mark={voice.lineKey === `lesson:${lesson.id}` && voice.status !== 'idle' ? voice.charIndex : null} />
            </p>
            <ListenButton
              scriptKey={`lesson:${lesson.id}`}
              title={lesson.title}
              label="Listen"
              lines={[{ key: `lesson:${lesson.id}`, label: lesson.title, text: lesson.body }]}
            />
          </div>
        ) : (
          <button key={lesson.id} type="button" className="text-btn" onClick={() => setExtra(lesson.id)}>
            {lesson.title}
          </button>
        )
      })}
    </div>
  )
}

export function WordLesson({
  word,
  gloss,
  language,
  aside,
}: {
  word: OriginalWord
  gloss?: Gloss | null
  language: string
  aside?: string
}) {
  const letters = useAppState().school.letters
  const script = wordScript(language)
  const marks = glyphs(word.w, script)
  const [at, setAt] = useState(0)
  useEffect(() => { setAt(0) }, [word.w, word.m])
  const glyph = marks[at] ?? marks[0]
  const voice = useVoice()
  const reading = transliterate(word.w, script)
  const heard = reading || gloss?.p || gloss?.x || ''
  const soundKey = `sound:${script}:${heard}`
  const small = functionWord(word.w, word.m)
  const lines = lexiconLines(gloss)
  const meaning = lines.meaning || small || gloss?.g || ''
  const same = gloss?.l ? consonants(gloss.l) === consonants(word.w) : true
  const met = letters.filter((id) => id.startsWith(`${script}:`)).length
  const rtl = script === 'he'
  return (
    <div className={rtl ? 'lesson-word rtl' : 'lesson-word'}>
      <p className={`stage-word ${script}`} dir={rtl ? 'rtl' : 'ltr'}>{word.w}</p>
      {heard ? (
        <p className="reading">
          <SpokenText text={reading || gloss?.x || heard} mark={voice.lineKey === soundKey && voice.status !== 'idle' ? voice.charIndex : null} />
        </p>
      ) : null}
      {gloss?.p ? <p className="quiet">Strong’s sound {gloss.p}</p> : null}
      <div className="row">
        {heard ? (
          <ListenButton
            scriptKey={soundKey}
            title={word.w}
            label="Hear it"
            className="choice"
            lines={[{ key: soundKey, label: word.w, text: heard, lang: script === 'he' ? 'he' : 'el' }]}
          />
        ) : null}
        {word.s ? (
          <button type="button" className="text-btn" onClick={() => go(`/strong/${word.s}`)}>
            {word.s}
          </button>
        ) : null}
      </div>
      {meaning ? (
        <>
          <p className="meaning-line"><Linked text={meaning} /></p>
          <ListenButton
            scriptKey={`meaning:${word.s || word.w}`}
            title="Meaning"
            label="Read the meaning"
            lines={[{ key: `meaning:${word.s || word.w}`, label: 'Meaning', text: [meaning, lines.extra].filter(Boolean).join('. ') }]}
          />
        </>
      ) : <p className="quiet">The lexicon line for this form is not linked. The letters and the grammar are the lesson.</p>}
      {lines.extra ? <p className="quiet">Also: <Linked text={lines.extra} /></p> : null}
      {gloss?.g && (lines.meaning || lines.extra) ? <p className="quiet">King James renderings: {gloss.g}</p> : null}
      {gloss?.l && !same ? (
        <p className={script === 'he' ? 'dict-form he' : 'dict-form gr'} dir={rtl ? 'rtl' : 'ltr'}>
          Dictionary form {gloss.l}
          {gloss.x ? <span className="quiet"> {gloss.x}</span> : null}
        </p>
      ) : null}
      {lines.origin ? <p className="quiet">Where it comes from: <Linked text={lines.origin} /></p> : null}
      {aside ? <p>{aside}</p> : null}
      {marks.length ? (
        <>
          <div className={rtl ? 'letter-row rtl' : 'letter-row'} dir={rtl ? 'rtl' : 'ltr'}>
            {marks.map((item, index) => (
              <button
                key={`${item.text}-${index}`}
                type="button"
                className={['glyph', script, letters.includes(item.key) ? 'met' : '', glyph === item ? 'on' : ''].filter(Boolean).join(' ')}
                style={{ ['--i' as string]: String(index) }}
                onClick={() => {
                  setAt(index)
                  meetLetter(item.key)
                }}
              >
                <span>{item.text}</span>
                <small>{item.name.split(' ')[0]}</small>
              </button>
            ))}
          </div>
          {glyph ? <p><span className="part">{glyph.name}</span> {glyph.sound}</p> : null}
          <p className="quiet">You have met {met} of the {alphabetSize(script)} {language === 'Aramaic' ? 'Hebrew' : language} letters. A first reading of the letters in this word.</p>
        </>
      ) : null}
    </div>
  )
}

export function GrammarBlock({ morph }: { morph: string }) {
  const note = explainMorph(morph)
  const voice = useVoice()
  return (
    <div>
      {note.line ? (
        <>
          <p className="meaning-line">
            <SpokenText text={note.line} mark={voice.lineKey === `morph:${morph}` && voice.status !== 'idle' ? voice.charIndex : null} />
          </p>
          <ListenButton
            scriptKey={`morph:${morph}`}
            title="Grammar"
            label="Listen"
            lines={[{ key: `morph:${morph}`, label: 'Grammar', text: note.line }]}
          />
        </>
      ) : null}
      <LessonCards ids={note.lessonIds} />
    </div>
  )
}
