import { useEffect, useRef, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { formatRef, parseRef, parseSpokenRef } from '../lib/canon'
import {
  controlSermon,
  joinChurch,
  leaveChurch,
  loadSharedNotes,
  loadSermons,
  regenerateInvite,
  registerChurch,
  removeSermon,
  saveSermon,
  setMemberRole,
  type Sermon,
  type SermonStep,
  type SharedNote,
  type StepDraft,
} from '../lib/church'
import { followSermon, refreshLive, reviewSermon } from '../lib/follow'
import { go, type Route } from '../lib/router'
import { errorMessage, changePassword, createAccount, signInWithEmail, signInWithGoogle, signOut, useSession } from '../lib/session'
import { dayKey } from '../lib/storage'

type GoogleButtonOpts = {
  theme: string
  size: string
  text: string
  shape: string
  width: number
}

type GoogleId = {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonOpts) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

function loadGoogle(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve()
  const found = document.querySelector<HTMLScriptElement>('script[data-google-gsi]')
  if (found) {
    return new Promise((resolve, reject) => {
      found.addEventListener('load', () => resolve(), { once: true })
      found.addEventListener('error', () => reject(new Error('Google sign-in did not load.')), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.googleGsi = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google sign-in did not load.'))
    document.head.appendChild(script)
  })
}

function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const clientId = useSession().googleClientId
  const holder = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  onCredentialRef.current = onCredential
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const parent = holder.current
    if (!parent || !clientId) return
    let cancel = false
    void loadGoogle()
      .then(() => {
        const google = window.google?.accounts.id
        if (cancel || !google || !holder.current) return
        google.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
        })
        holder.current.replaceChildren()
        google.renderButton(holder.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: 280,
        })
      })
      .catch(() => {
        if (!cancel) setFailed(true)
      })
    return () => {
      cancel = true
    }
  }, [clientId])

  if (!clientId) return <p className="quiet">Sign in with Google can be added later.</p>
  if (failed) return <p className="quiet">Google sign-in did not load.</p>
  return <div ref={holder} className="google-btn" />
}

function AccountSignIn({ busy, onBusy, onError }: { busy: boolean; onBusy: (value: boolean) => void; onError: (value: string) => void }) {
  const [creating, setCreating] = useState(true)
  const [accountName, setAccountName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    onBusy(true)
    onError('')
    try {
      if (creating) await createAccount(accountName, email, password)
      else await signInWithEmail(email, password)
    } catch (reason) {
      onError(errorMessage(reason, creating ? 'The account could not be created.' : 'Sign-in did not finish.'))
    } finally {
      onBusy(false)
    }
  }

  return (
    <form className="church-form" onSubmit={(event) => void submit(event)}>
      {creating ? (
        <label className="field">
          <span>Your name</span>
          <input value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={255} required autoComplete="name" aria-label="Your name" />
        </label>
      ) : null}
      <label className="field">
        <span>Email</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={255} required autoComplete="email" aria-label="Email" />
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={200} required autoComplete={creating ? 'new-password' : 'current-password'} aria-label="Password" />
      </label>
      <div className="row">
        <button type="submit" className="choice gold" disabled={busy}>{creating ? 'Create account' : 'Sign in'}</button>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            setCreating((value) => !value)
            onError('')
          }}
        >
          {creating ? 'I already have an account' : 'Create an account'}
        </button>
      </div>
    </form>
  )
}

function PasswordChange({ busy, onBusy, onError }: { busy: boolean; onBusy: (value: boolean) => void; onError: (value: string) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    onBusy(true)
    onError('')
    setSaved(false)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setSaved(true)
    } catch (reason) {
      onError(errorMessage(reason, 'The password could not be changed.'))
    } finally {
      onBusy(false)
    }
  }

  return (
    <form className="panel church-form" onSubmit={(event) => void submit(event)}>
      <h2>Password</h2>
      <label className="field">
        <span>Current password</span>
        <input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} minLength={8} maxLength={200} required autoComplete="current-password" aria-label="Current password" />
      </label>
      <label className="field">
        <span>New password</span>
        <input type="password" value={next} onChange={(event) => setNext(event.target.value)} minLength={8} maxLength={200} required autoComplete="new-password" aria-label="New password" />
      </label>
      <div className="row">
        <button type="submit" className="choice" disabled={busy}>Change password</button>
        {saved ? <p className="quiet">Password changed.</p> : null}
      </div>
    </form>
  )
}

function InviteQr({ value }: { value: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let cancel = false
    void QRCode.toDataURL(value, {
      margin: 1,
      width: 192,
      errorCorrectionLevel: 'M',
      color: { dark: '#1c1915', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancel) setSrc(url)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [value])
  if (!src) return null
  return <img className="invite-qr" src={src} width={192} height={192} alt="QR code for the invite link" />
}

function stepLabel(step: SermonStep): string {
  if (step.heading) return step.heading
  if (step.passage && parseRef(step.passage)) return formatRef(step.passage)
  return 'Note'
}

function stepPassage(step: SermonStep): string {
  if (!step.passage || !parseRef(step.passage)) return ''
  const label = formatRef(step.passage)
  return step.heading && label !== step.heading ? label : ''
}

type EditorStep = { key: string; heading: string; passage: string; note: string }
type EditorDraft = { id: string; title: string; steps: EditorStep[] }

function newKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function blankStep(): EditorStep {
  return { key: newKey(), heading: '', passage: '', note: '' }
}

function blankDraft(): EditorDraft {
  return { id: '', title: '', steps: [blankStep()] }
}

function draftFrom(sermon: Sermon): EditorDraft {
  return {
    id: sermon.id,
    title: sermon.title,
    steps: sermon.steps.length
      ? sermon.steps.map((step) => ({
        key: step.id || newKey(),
        heading: step.heading,
        passage: step.passage && parseRef(step.passage) ? formatRef(step.passage) : step.passage,
        note: step.note,
      }))
      : [blankStep()],
  }
}

function showDate(iso: string, today: string): string {
  if (iso === today) return 'Today'
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year || 0, (month || 1) - 1, day || 1)
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function SermonOutline({ steps }: { steps: SermonStep[] }) {
  return (
    <ol className="outline">
      {steps.map((step) => {
        const passage = stepPassage(step)
        return (
          <li key={step.id}>
            <strong>{stepLabel(step)}</strong>
            {passage ? <span className="quiet"> {passage}</span> : null}
            {step.note ? <p className="sermon-body">{step.note}</p> : null}
          </li>
        )
      })}
    </ol>
  )
}

function SermonCard({ sermon, today, live }: { sermon: Sermon; today: string; live: boolean }) {
  const kicker = live ? 'Live now' : sermon.status === 'draft' ? 'Draft' : showDate(sermon.sermonDate, today)
  return (
    <article className={live ? 'opening' : 'panel'}>
      <p className="kicker">{kicker}</p>
      <h2>{sermon.title}</h2>
      {live ? <p className="quiet">The congregation is on step {sermon.currentStep + 1} of {sermon.steps.length}.</p> : null}
      <SermonOutline steps={sermon.steps} />
      <p className="quiet">{sermon.authorName}</p>
    </article>
  )
}

export function Church({ route }: { route: Extract<Route, { name: 'church' }> | Extract<Route, { name: 'join' }> }) {
  const session = useSession()
  const code = route.name === 'join' ? route.code : ''
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [joinCode, setJoinCode] = useState(code)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const [today, setToday] = useState(dayKey())
  const [sermons, setSermons] = useState<Sermon[]>([])
  const [notes, setNotes] = useState<SharedNote[]>([])
  const [draft, setDraft] = useState<EditorDraft>(() => blankDraft())
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmSermon, setConfirmSermon] = useState('')
  const attempt = useRef('')

  useEffect(() => {
    setJoinCode(code)
  }, [code])

  useEffect(() => {
    if (!code || session.status !== 'ready' || session.church || attempt.current === code) return
    attempt.current = code
    setBusy(true)
    setError('')
    void joinChurch(code)
      .then(() => go('/church'))
      .catch((reason: unknown) => {
        attempt.current = ''
        setError(errorMessage(reason, 'That church could not be joined.'))
      })
      .finally(() => setBusy(false))
  }, [code, session.church, session.status])

  useEffect(() => {
    if (session.status !== 'ready' || !session.church) return
    let cancel = false
    void loadSermons()
      .then((data) => {
        if (cancel) return
        setToday(data.today)
        setSermons(data.sermons)
        setDraft((current) => (current.id || current.title ? current : current))
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(errorMessage(reason, 'The sermons did not load.'))
      })
    void loadSharedNotes()
      .then((data) => {
        if (!cancel) setNotes(data)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [session.church, session.role, session.status])

  async function onCredential(credential: string) {
    setBusy(true)
    setError('')
    try {
      await signInWithGoogle(credential)
    } catch (reason) {
      setError(errorMessage(reason, 'Google sign-in did not finish.'))
    } finally {
      setBusy(false)
    }
  }

  async function onRegister(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await registerChurch({
        name,
        city,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      setName('')
      setCity('')
    } catch (reason) {
      setError(errorMessage(reason, 'The church could not be registered.'))
    } finally {
      setBusy(false)
    }
  }

  async function onJoin(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await joinChurch(joinCode)
      go('/church')
    } catch (reason) {
      setError(errorMessage(reason, 'That church could not be joined.'))
    } finally {
      setBusy(false)
    }
  }

  async function copyText(value: string, which: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
    } catch {
      setError('The code could not be copied from this browser.')
    }
  }

  function updateStep(key: string, patch: Partial<EditorStep>) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.key === key ? { ...step, ...patch } : step)),
    }))
  }

  function moveEditorStep(index: number, delta: -1 | 1) {
    setDraft((current) => {
      const next = index + delta
      if (next < 0 || next >= current.steps.length) return current
      const steps = current.steps.slice()
      const [item] = steps.splice(index, 1)
      if (!item) return current
      steps.splice(next, 0, item)
      return { ...current, steps }
    })
  }

  async function reloadSermons() {
    const data = await loadSermons()
    setToday(data.today)
    setSermons(data.sermons)
    await refreshLive()
  }

  async function onSaveSermon(event: FormEvent) {
    event.preventDefault()
    const steps: StepDraft[] = []
    for (const step of draft.steps) {
      const heading = step.heading.trim()
      const passage = step.passage.trim()
      const note = step.note.trim()
      if (!heading && !passage && !note) continue
      if (passage && !parseSpokenRef(passage)) {
        setError(`"${passage}" is not a passage this Bible can open.`)
        return
      }
      steps.push({ heading, passage, note })
    }
    if (!draft.title.trim()) {
      setError('A sermon needs a title.')
      return
    }
    if (!steps.length) {
      setError('Add at least one step.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await saveSermon({ id: draft.id, title: draft.title.trim(), steps })
      await reloadSermons()
      setDraft(blankDraft())
      setConfirmSermon('')
    } catch (reason) {
      setError(errorMessage(reason, 'The sermon could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  async function onDeleteSermon(id: string) {
    setBusy(true)
    setError('')
    try {
      await removeSermon(id)
      setSermons((current) => current.filter((sermon) => sermon.id !== id))
      setDraft((current) => (current.id === id ? blankDraft() : current))
      setConfirmSermon('')
      await refreshLive()
    } catch (reason) {
      setError(errorMessage(reason, 'The sermon could not be removed.'))
    } finally {
      setBusy(false)
    }
  }

  async function onControl(id: string, body: { action: 'start' | 'end' } | { action: 'step'; step: number }) {
    setBusy(true)
    setError('')
    try {
      await controlSermon(id, body)
      await reloadSermons()
    } catch (reason) {
      setError(errorMessage(reason, 'The service could not be changed.'))
    } finally {
      setBusy(false)
    }
  }

  const church = session.church
  const pastor = session.role === 'pastor'
  const liveSermons = sermons.filter((sermon) => sermon.status === 'live')
  const drafts = sermons.filter((sermon) => sermon.status === 'draft')
  const earlier = sermons.filter((sermon) => sermon.status === 'ended')
  const inviteLink = church?.inviteCode ? `${window.location.origin}${window.location.pathname}#/join/${church.inviteCode}` : ''

  return (
    <div>
      <p className="kicker">Church</p>
      <h1>{church ? church.name : 'Sign in'}</h1>
      <p className="lede">
        {church
          ? `${church.city}. A pastor starts the sermon when the service begins, and the congregation follows in the Bible.`
          : 'Sign in to join a church. When the pastor starts the service, you can follow along in the Bible.'}
      </p>
      {session.notice ? <p className="quiet">{session.notice}</p> : null}
      {error ? <p className="quiet" role="alert">{error}</p> : null}
      {busy ? <p className="quiet">Working…</p> : null}

      {session.status === 'loading' ? <p className="quiet">Opening your church…</p> : null}

      {session.status === 'signed-out' ? (
        <section className="panel">
          <p className="quiet">This account stores your name and email on this server. Reading, study, and memory stay on this device.</p>
          {code ? <p>After you sign in, this account joins with the code {code}.</p> : null}
          <AccountSignIn busy={busy} onBusy={setBusy} onError={setError} />
          <div className="google-option">
            <p className="kicker">Google</p>
            <GoogleButton onCredential={(credential) => void onCredential(credential)} />
          </div>
        </section>
      ) : null}

      {session.status === 'ready' && session.user && !church ? (
        <div className="church-split">
          <form className="panel church-form" onSubmit={(event) => void onRegister(event)}>
            <h2>Register a church</h2>
            <p className="quiet">This account becomes the pastor.</p>
            <label className="field">
              <span>Church name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required aria-label="Church name" />
            </label>
            <label className="field">
              <span>City</span>
              <input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} required aria-label="City" />
            </label>
            <button type="submit" className="choice gold" disabled={busy}>Register</button>
          </form>
          <form className="panel church-form" onSubmit={(event) => void onJoin(event)}>
            <h2>Join with a code</h2>
            <p className="quiet">Use the code your pastor shared.</p>
            <label className="field">
              <span>Invite code</span>
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} maxLength={16} autoCapitalize="characters" required aria-label="Invite code" />
            </label>
            <button type="submit" className="choice" disabled={busy}>Join</button>
          </form>
        </div>
      ) : null}

      {session.status === 'ready' && church && code && !busy ? (
        <p className="quiet">You are already in {church.name}.</p>
      ) : null}

      {church && pastor && church.inviteCode ? (
        <section className="opening" aria-label="Invite">
          <p className="kicker">Invite the congregation</p>
          <p className="invite-code">{church.inviteCode}</p>
          <InviteQr value={inviteLink} />
          <p className="quiet">Scan the code, or type it after signing in. Days follow {church.timezone}.</p>
          <div className="row">
            <button type="button" className="choice" onClick={() => void copyText(church.inviteCode || '', 'code')}>
              {copied === 'code' ? 'Copied' : 'Copy code'}
            </button>
            <button type="button" className="choice" onClick={() => void copyText(inviteLink, 'link')}>
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              className="text-btn"
              disabled={busy}
              onClick={() => {
                setError('')
                void regenerateInvite().catch((reason: unknown) => setError(errorMessage(reason, 'The code could not be changed.')))
              }}
            >
              New code
            </button>
          </div>
        </section>
      ) : null}

      {church && liveSermons.length ? (
        <div className="sermon-list">
          {liveSermons.map((sermon) => (
            <div key={sermon.id}>
              <SermonCard sermon={sermon} today={today} live />
              <div className="row sermon-actions">
                <button type="button" className="choice gold" onClick={() => followSermon(sermon)}>Follow along</button>
                {pastor ? (
                  <>
                    <button type="button" className="choice" disabled={busy || sermon.currentStep <= 0} onClick={() => void onControl(sermon.id, { action: 'step', step: sermon.currentStep - 1 })}>Previous</button>
                    <button type="button" className="choice" disabled={busy || sermon.currentStep >= sermon.steps.length - 1} onClick={() => void onControl(sermon.id, { action: 'step', step: sermon.currentStep + 1 })}>Next</button>
                    <button type="button" className="choice" disabled={busy} onClick={() => void onControl(sermon.id, { action: 'end' })}>End</button>
                    <button type="button" className="text-btn" onClick={() => setDraft(draftFrom(sermon))}>Edit</button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {church && !liveSermons.length && !pastor ? (
        <section className="panel">
          <h2>Service</h2>
          <p className="quiet">No sermon is live. It opens when the pastor starts it.</p>
        </section>
      ) : null}

      {church && pastor ? (
        <form className="panel church-form" onSubmit={(event) => void onSaveSermon(event)}>
          <h2>{draft.id ? 'Edit sermon' : 'Set a sermon'}</h2>
          <p className="quiet">Save the outline, then start it when the service begins. The congregation does not see a draft.</p>
          <label className="field">
            <span>Title</span>
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={160} required aria-label="Sermon title" />
          </label>
          <div className="step-editor">
            {draft.steps.map((step, index) => (
              <div className="step-card" key={step.key}>
                <p className="kicker">Step {index + 1}</p>
                <label className="field">
                  <span>Heading</span>
                  <input value={step.heading} onChange={(event) => updateStep(step.key, { heading: event.target.value })} maxLength={160} aria-label={`Heading for step ${index + 1}`} />
                </label>
                <label className="field">
                  <span>Passage</span>
                  <input value={step.passage} onChange={(event) => updateStep(step.key, { passage: event.target.value })} maxLength={80} aria-label={`Passage for step ${index + 1}`} placeholder="John 1:1–18" />
                </label>
                <label className="field">
                  <span>Note</span>
                  <textarea value={step.note} onChange={(event) => updateStep(step.key, { note: event.target.value })} maxLength={4000} rows={3} aria-label={`Note for step ${index + 1}`} />
                </label>
                <div className="row">
                  <button type="button" className="text-btn" disabled={index === 0} onClick={() => moveEditorStep(index, -1)}>Move up</button>
                  <button type="button" className="text-btn" disabled={index === draft.steps.length - 1} onClick={() => moveEditorStep(index, 1)}>Move down</button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      steps: current.steps.length === 1 ? [blankStep()] : current.steps.filter((item) => item.key !== step.key),
                    }))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="row">
            <button type="button" className="text-btn" disabled={draft.steps.length >= 20} onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, blankStep()] }))}>Add step</button>
            <button type="submit" className="choice gold" disabled={busy}>{draft.id ? 'Save sermon' : 'Set sermon'}</button>
            {draft.id ? (
              <button type="button" className="text-btn" onClick={() => setDraft(blankDraft())}>New sermon</button>
            ) : null}
          </div>
        </form>
      ) : null}

      {church && pastor && drafts.length ? (
        <section>
          <h2>Drafts</h2>
          <div className="sermon-list">
            {drafts.map((sermon) => (
              <div key={sermon.id}>
                <SermonCard sermon={sermon} today={today} live={false} />
                <div className="row sermon-actions">
                  <button type="button" className="choice gold" disabled={busy} onClick={() => void onControl(sermon.id, { action: 'start' })}>Start</button>
                  <button type="button" className="text-btn" onClick={() => setDraft(draftFrom(sermon))}>Edit</button>
                  {confirmSermon === sermon.id ? (
                    <button type="button" className="text-btn" disabled={busy} onClick={() => void onDeleteSermon(sermon.id)}>Delete this sermon</button>
                  ) : (
                    <button type="button" className="text-btn" onClick={() => setConfirmSermon(sermon.id)}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {church && earlier.length ? (
        <section>
          <h2>Earlier</h2>
          <div className="sermon-list">
            {earlier.map((sermon) => (
              <div key={sermon.id}>
                <SermonCard sermon={sermon} today={today} live={false} />
                <div className="row sermon-actions">
                  <button type="button" className="choice" onClick={() => reviewSermon(sermon)}>Read through</button>
                  {pastor ? (
                    <>
                      <button type="button" className="choice" disabled={busy} onClick={() => void onControl(sermon.id, { action: 'start' })}>Start again</button>
                      <button type="button" className="text-btn" onClick={() => setDraft(draftFrom(sermon))}>Edit</button>
                      {confirmSermon === sermon.id ? (
                        <button type="button" className="text-btn" disabled={busy} onClick={() => void onDeleteSermon(sermon.id)}>Delete this sermon</button>
                      ) : (
                        <button type="button" className="text-btn" onClick={() => setConfirmSermon(sermon.id)}>Delete</button>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {church && notes.length ? (
        <section className="panel">
          <h2>Notes for the congregation</h2>
          {notes.map((note) => {
            const parsed = parseRef(note.verseId)
            return (
              <div className="member-row" key={note.id}>
                <span>
                  <strong>{parsed ? formatRef(note.verseId) : note.verseId}</strong>
                  <span className="quiet note-preview">{note.authorName}. {note.body.length > 140 ? `${note.body.slice(0, 140)}…` : note.body}</span>
                </span>
                {parsed ? (
                  <button type="button" className="text-btn" onClick={() => go(`/study/${parsed.book}/${parsed.chapter}/${parsed.verse}`)}>
                    Open
                  </button>
                ) : null}
              </div>
            )
          })}
        </section>
      ) : null}
      {church && pastor && !notes.length ? (
        <p className="quiet">Share a note from any verse you are studying, and it appears here for the congregation.</p>
      ) : null}

      {church && pastor ? (
        <section className="panel">
          <h2>People</h2>
          {session.members.map((member) => (
            <div className="member-row" key={member.id}>
              <span>
                <strong>{member.name}</strong>
                <span className="quiet"> {member.role === 'pastor' ? 'Pastor' : 'Congregation'} · {member.email}</span>
              </span>
              {member.id === session.user?.id ? (
                <span className="quiet">You</span>
              ) : (
                <button
                  type="button"
                  className="text-btn"
                  disabled={busy}
                  onClick={() => {
                    setError('')
                    const next = member.role === 'pastor' ? 'member' : 'pastor'
                    void setMemberRole(member.id, next).catch((reason: unknown) => {
                      setError(errorMessage(reason, 'That role could not be changed.'))
                    })
                  }}
                >
                  {member.role === 'pastor' ? 'Make member' : 'Make pastor'}
                </button>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {session.status === 'ready' && session.user?.hasPassword ? (
        <PasswordChange busy={busy} onBusy={setBusy} onError={setError} />
      ) : null}

      {session.status === 'ready' ? (
        <div className="row church-foot">
          {church ? (
            confirmLeave ? (
              <>
                <button
                  type="button"
                  className="text-btn"
                  disabled={busy}
                  onClick={() => {
                    setError('')
                    void leaveChurch()
                      .then(() => setConfirmLeave(false))
                      .catch((reason: unknown) => setError(errorMessage(reason, 'You could not leave this church.')))
                  }}
                >
                  Leave {church.name}
                </button>
                <button type="button" className="text-btn" onClick={() => setConfirmLeave(false)}>Stay</button>
              </>
            ) : (
              <button type="button" className="text-btn" onClick={() => setConfirmLeave(true)}>Leave this church</button>
            )
          ) : null}
          <button type="button" className="text-btn" onClick={() => void signOut()}>Sign out</button>
        </div>
      ) : null}
    </div>
  )
}

