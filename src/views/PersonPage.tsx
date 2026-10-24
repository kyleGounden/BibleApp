import { bookName, formatRef, parseRef } from '../lib/canon'
import { booksForPerson, journeysForPerson, personById, useGuides } from '../lib/guide'
import { placeById, usePlaces } from '../lib/places'
import { go, type Route } from '../lib/router'

export function PersonPage({ route }: { route: Extract<Route, { name: 'person' }> }) {
  const guides = useGuides()
  const places = usePlaces()
  const person = guides ? personById(guides, route.id) : undefined
  const books = guides && person ? booksForPerson(guides, person.id) : []
  const roads = guides && person ? journeysForPerson(guides, person.id) : []
  const origin = placeById(places, person?.origin)

  if (!guides) return <p className="quiet">Opening the life…</p>
  if (!person) return <p>That writer is not in the setting.</p>

  return (
    <div>
      <p className="kicker">Writer</p>
      <h1>{person.name}</h1>
      {person.also ? <p className="lede">{person.also}</p> : null}
      <p>{person.about}</p>
      <div className="chips">
        {origin ? (
          <button type="button" className="chip" onClick={() => go(`/places/${origin.id}`)}>{origin.name}</button>
        ) : null}
        {person.verses.map((id) => (
          <button key={id} type="button" className="chip" onClick={() => {
            const parsed = parseRef(id)
            if (parsed) go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)
          }}>{formatRef(id)}</button>
        ))}
      </div>
      {books.length ? (
        <section>
          <h2>Books</h2>
          {books.map((book) => (
            <button key={book.id} type="button" className="list-btn" onClick={() => go(`/book/${book.id}`)}>
              <strong>{bookName(book.id)}</strong>
              <span className="quiet">{book.line}</span>
            </button>
          ))}
        </section>
      ) : null}
      {roads.length ? (
        <section>
          <h2>Journeys</h2>
          {roads.map((journey) => (
            <button key={journey.id} type="button" className="list-btn" onClick={() => go(`/journey/${journey.id}`)}>
              <strong>{journey.title}</strong>
              <span className="quiet">{journey.summary}</span>
            </button>
          ))}
        </section>
      ) : null}
    </div>
  )
}
