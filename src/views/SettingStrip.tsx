import { useEffect, useState } from 'react'
import { formatRef } from '../lib/canon'
import { howLabel, readPath, settingFor, useGuides, writerName, type ChainStop } from '../lib/guide'
import { placeById, usePlaces, type Place } from '../lib/places'
import { go } from '../lib/router'

export function RouteStepper({
  places,
  stops,
  bookId,
}: {
  places: Place[]
  stops: ChainStop[]
  bookId?: string
}) {
  if (!stops.length) return null
  return (
    <div className="route-stepper" aria-label="The road">
      {stops.map((item, index) => {
        const place = placeById(places, item.stop.place)
        return (
          <span className="route-leg" key={`${item.stop.place}-${index}`}>
            {index ? <span className="route-arrow" aria-hidden="true">→</span> : null}
            <button
              type="button"
              className={item.on ? 'route-step on' : 'route-step'}
              onClick={() => go(readPath(item.stop, bookId))}
            >
              {place?.name ?? item.stop.place}
            </button>
          </span>
        )
      })}
    </div>
  )
}

export function SettingStrip({ bookId, chapter }: { bookId: string; chapter: number }) {
  const guides = useGuides()
  const places = usePlaces()
  const setting = guides && guides.books.length ? settingFor(guides, bookId, chapter) : null
  const guide = setting?.guide
  const travel = (setting?.journeys.length ?? 0) > 0
  const [open, setOpen] = useState(chapter === 1)
  useEffect(() => {
    setOpen(chapter === 1 || travel)
  }, [bookId, chapter, travel])

  if (!guide || !guides) return null
  const name = writerName(guides, guide)
  const showFacts = chapter === 1 || !travel

  return (
    <section className="setting-strip">
      <button type="button" className="setting-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="kicker">{travel ? setting.journeys.map((item) => item.journey.title).join(' · ') : 'This book'}</span>
        <strong>{guide.line}</strong>
      </button>
      {open ? (
        <div className="setting-body">
          {showFacts ? (
            <div className="facts">
              <div className="fact">
                <span>Who wrote it</span>
                <strong>{name}</strong>
                <p className="quiet">{howLabel(guide.writer.how)}</p>
              </div>
              <div className="fact">
                <span>Who heard it</span>
                <strong>{guide.audience.who}</strong>
              </div>
              <div className="fact">
                <span>Why</span>
                <strong>{guide.purpose}</strong>
              </div>
            </div>
          ) : null}
          {setting.journeys.map((item) => (
            <div key={item.journey.id} className="setting-road">
              {setting.journeys.length > 1 ? <p className="kicker">{item.journey.title}</p> : null}
              <RouteStepper places={places} stops={item.chain} bookId={bookId} />
              <p>{item.sentence}</p>
            </div>
          ))}
          <div className="row">
            <button type="button" className="choice" onClick={() => go(`/book/${bookId}`)}>About this book</button>
            {guide.writer.person ? (
              <button type="button" className="choice" onClick={() => go(`/person/${guide.writer.person}`)}>{name}</button>
            ) : null}
            {guide.writer.verse ? (
              <button type="button" className="choice" onClick={() => go(readVerse(guide.writer.verse!))}>{formatRef(guide.writer.verse)}</button>
            ) : null}
            {setting.journeys[0] ? (
              <button type="button" className="choice" onClick={() => go(`/journey/${setting.journeys[0].journey.id}`)}>The map</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function readVerse(id: string): string {
  const [book, chapter, verse] = id.split('.')
  return `/read/${book}/${chapter}/${verse ?? 1}`
}
