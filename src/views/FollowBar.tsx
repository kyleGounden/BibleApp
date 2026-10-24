import { useState } from 'react'
import { formatRef, parseRef } from '../lib/canon'
import { browseStep, leaveFollow, pastorMove, rejoinPastor, useFollow } from '../lib/follow'
import { errorMessage, useSession } from '../lib/session'

export function FollowBar() {
  const follow = useFollow()
  const session = useSession()
  const following = follow.following
  const [error, setError] = useState('')
  if (!following) return null
  const active = following
  const step = active.sermon.steps[active.step]
  if (!step) return null
  const count = active.sermon.steps.length
  const pastorDriving = session.role === 'pastor' && active.mode === 'live' && follow.live?.id === active.sermonId
  const label = step.heading || (step.passage && parseRef(step.passage) ? formatRef(step.passage) : 'Note')
  const passage = step.passage && parseRef(step.passage) ? formatRef(step.passage) : ''

  async function shift(delta: -1 | 1) {
    const index = active.step + delta
    if (index < 0 || index >= count) return
    setError('')
    try {
      if (pastorDriving) await pastorMove(index)
      else browseStep(index)
    } catch (reason) {
      setError(errorMessage(reason, 'That step could not be opened.'))
    }
  }

  return (
    <section className="follow-bar" aria-label="Sermon">
      <p className="kicker">{active.mode === 'live' ? 'Live' : 'Sermon'} · {active.sermon.title}</p>
      <h2>{label}</h2>
      {passage && step.heading ? <p className="quiet">{passage}</p> : null}
      {step.note ? <p className="sermon-body">{step.note}</p> : null}
      <p className="quiet">Step {active.step + 1} of {count}{active.mode === 'live' && active.withPastor ? ' · With the pastor' : ''}</p>
      {error ? <p className="quiet" role="alert">{error}</p> : null}
      <div className="row">
        <button type="button" className="choice" disabled={active.step <= 0} onClick={() => void shift(-1)}>Previous</button>
        <button type="button" className="choice" disabled={active.step >= count - 1} onClick={() => void shift(1)}>Next</button>
        {active.mode === 'live' && !active.withPastor ? (
          <button type="button" className="choice gold" onClick={() => rejoinPastor()}>With the pastor</button>
        ) : null}
        <button type="button" className="text-btn" onClick={() => leaveFollow()}>Close</button>
      </div>
    </section>
  )
}
