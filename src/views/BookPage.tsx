import { useState } from 'react'
import { SHELVES, bookById, bookName, formatRef } from '../lib/canon'
import { bookGuide, howLabel, journeysForBook, personById, readPath, writerName, useGuides, type Journey } from '../lib/guide'
import { placeById, usePlaces } from '../lib/places'
import { go, type Route } from '../lib/router'
import { AtlasMap } from './AtlasMap'
import { RouteStepper } from './SettingStrip'

function roadPins(journey: Journey): string[] {
  return journey.stops.map((stop) => stop.place)
}

export function BookPage({ route }: { route: Extract<Route, { name: 'book' }> }) {
  const guides = useGuides()
  const places = usePlaces()
  const book = bookById(route.id)
  const guide = guides ? bookGuide(guides, route.id) : undefined
  const roads = guides ? journeysForBook(guides, route.id) : []
  const [roadId, setRoadId] = useState('')
  const road = roads.find((journey) => journey.id === roadId) ?? roads[0]
  const shelf = SHELVES.find((item) => item.books.includes(route.id))
  const person = guides && guide ? personById(guides, guide.writer.person) : undefined

  if (!book) return <p>That book is not in the canon.</p>
  if (!guides) return <p className="quiet">Opening the setting…</p>
  if (!guide) return <p>That book has no setting yet.</p>

  const from = placeById(places, guide.writtenFrom)
  const heard = placeById(places, guide.audience.where)
  const pins = road
    ? roadPins(road)
    : [...new Set([guide.writtenFrom, guide.audience.where, ...(guide.mapPlaces ?? [])].filter((id): id is string => !!id))]

  return (
    <div>
      <p className="kicker">{shelf?.name ?? (book.testament === 'OT' ? 'Old Testament' : 'New Testament')}</p>
      <h1>{book.name}</h1>
      <p className="lede">{guide.line}</p>
      <div className="facts">
        <div className="fact">
          <span>Who wrote it</span>
          <strong>{writerName(guides, guide)}</strong>
          <p className="quiet">{howLabel(guide.writer.how)}</p>
        </div>
        <div className="fact">
          <span>Who heard it</span>
          <strong>{guide.audience.who}</strong>
          <p className="quiet">{guide.audience.when}</p>
        </div>
        <div className="fact">
          <span>Why</span>
          <strong>{guide.purpose}</strong>
        </div>
      </div>
      <div className="row">
        <button type="button" className="choice gold" onClick={() => go(`/read/${book.id}/1`)}>Start reading</button>
        {person ? (
          <button type="button" className="choice" onClick={() => go(`/person/${person.id}`)}>{person.name}</button>
        ) : null}
      </div>

      <section className="panel guide-block">
        <p className="kicker">The writer</p>
        <h2>{person ? person.name : 'No name is signed'}</h2>
        {person?.also ? <p className="quiet">{person.also}</p> : null}
        <p>{person ? person.about : guide.writer.note}</p>
        {person ? <p>{guide.writer.note}</p> : null}
        {guide.writer.verse ? (
          <button type="button" className="chip" onClick={() => {
            const id = guide.writer.verse
            if (!id) return
            const [b, c, v] = id.split('.')
            if (b && c) go(`/read/${b}/${c}/${v ?? 1}`)
          }}>{formatRef(guide.writer.verse)}</button>
        ) : null}
      </section>

      <section className="panel guide-block">
        <p className="kicker">The people then</p>
        <h2>{guide.audience.who}</h2>
        <p>{guide.audience.situation}</p>
        <p className="quiet">{guide.when}</p>
        {guide.fromNote ? <p>{guide.fromNote}</p> : null}
        <div className="chips">
          {from ? <button type="button" className="chip" onClick={() => go(`/places/${from.id}`)}>From {from.name}</button> : null}
          {heard ? <button type="button" className="chip" onClick={() => go(`/places/${heard.id}`)}>In {heard.name}</button> : null}
        </div>
      </section>

      <section>
        <h2>Through the book</h2>
        <div className="outline">
          {guide.outline.map((beat) => (
            <button key={`${beat.from}-${beat.label}`} type="button" className="outline-beat" onClick={() => go(`/read/${book.id}/${beat.from}`)}>
              <strong>{beat.label}</strong>
              <span className="quiet">{beat.from === beat.to ? `${bookName(book.id)} ${beat.from}` : `${bookName(book.id)} ${beat.from}–${beat.to}`}</span>
            </button>
          ))}
        </div>
      </section>

      {pins.length ? (
        <section>
          <h2>{road ? road.title : 'Places'}</h2>
          {road ? <p>{road.summary}</p> : null}
          {roads.length > 1 ? (
            <div className="chips" aria-label="Journeys in this book">
              {roads.map((journey) => (
                <button key={journey.id} type="button" className={journey.id === road.id ? 'chip on' : 'chip'} onClick={() => setRoadId(journey.id)}>
                  {journey.title}
                </button>
              ))}
            </div>
          ) : null}
          <AtlasMap
            places={places}
            pins={pins}
            line={!!road}
            onPick={(_id, index) => {
              if (!road) {
                go(`/places/${_id}`)
                return
              }
              const stop = road.stops[index]
              if (stop) go(readPath(stop, book.id))
            }}
          />
          {road ? (
            <>
              <RouteStepper places={places} stops={road.stops.map((stop) => ({ stop, on: false }))} bookId={book.id} />
              <button type="button" className="choice" onClick={() => go(`/journey/${road.id}`)}>Open the map</button>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
