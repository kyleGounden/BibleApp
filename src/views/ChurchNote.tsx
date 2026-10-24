import { useEffect, useState } from 'react'
import { loadSharedNotes, shareNote, unshareNote, type SharedNote } from '../lib/church'
import { errorMessage, useSession } from '../lib/session'

export function ChurchNote({ verseId, draft }: { verseId: string; draft: string }) {
  const session = useSession()
  const [notes, setNotes] = useState<SharedNote[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pastor = session.role === 'pastor'
  const churchId = session.church?.id ?? ''

  useEffect(() => {
    if (session.status !== 'ready' || !churchId) return
    let cancel = false
    setNotes([])
    setError('')
    void loadSharedNotes(verseId)
      .then((next) => {
        if (!cancel) setNotes(next)
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(errorMessage(reason, 'The church notes did not load.'))
      })
    return () => {
      cancel = true
    }
  }, [churchId, session.status, verseId])

  if (session.status !== 'ready' || !session.church) return null
  if (!pastor && !notes.length && !error) return null

  const mine = notes.some((note) => note.authorId === session.user?.id)

  async function publish() {
    const text = draft.trim()
    if (!text) {
      setError('Write a note, then you can share it with the congregation.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await shareNote(verseId, text)
      setNotes(await loadSharedNotes(verseId))
    } catch (reason) {
      setError(errorMessage(reason, 'The note could not be shared.'))
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    setBusy(true)
    setError('')
    try {
      await unshareNote(verseId)
      setNotes(await loadSharedNotes(verseId))
    } catch (reason) {
      setError(errorMessage(reason, 'The note could not be withdrawn.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="record-box">
      <h3>Congregation</h3>
      {notes.map((note) => (
        <p key={note.id}>
          <span className="quiet">{note.authorName}</span>
          <span className="sermon-body">{note.body}</span>
        </p>
      ))}
      {pastor ? (
        <>
          <p className="quiet">Sharing sends this note to {session.church.name}. Your other study notes stay on this device.</p>
          <div className="row">
            <button type="button" className="choice" disabled={busy || !draft.trim()} onClick={() => void publish()}>
              {mine ? 'Update the congregation note' : 'Share with the congregation'}
            </button>
            {mine ? (
              <button type="button" className="text-btn" disabled={busy} onClick={() => void withdraw()}>Stop sharing</button>
            ) : null}
          </div>
        </>
      ) : null}
      {error ? <p className="quiet" role="alert">{error}</p> : null}
    </div>
  )
}
