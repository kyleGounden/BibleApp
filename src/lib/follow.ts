import { useSyncExternalStore } from 'react'
import { parseRef } from './canon'
import { controlSermon, loadLive, type Sermon, type SermonStep } from './church'
import { go } from './router'

export type FollowMode = 'live' | 'review'

export type FollowSession = {
  sermonId: string
  mode: FollowMode
  step: number
  withPastor: boolean
  sermon: Sermon
}

type FollowState = {
  live: Sermon | null
  following: FollowSession | null
}

const empty: FollowState = { live: null, following: null }

let state: FollowState = empty
let watchEnabled = false
let watchFast = false
let watchToken = 0
let pollGen = 0
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getState(): FollowState {
  return state
}

export function useFollow(): FollowState {
  return useSyncExternalStore(subscribe, getState, getState)
}

function clamp(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(0, index), length - 1)
}

function sermonKey(sermon: Sermon | null): string {
  return sermon ? JSON.stringify(sermon) : ''
}

function followKey(session: FollowSession | null): string {
  if (!session) return ''
  return `${session.sermonId}|${session.mode}|${session.step}|${session.withPastor}|${sermonKey(session.sermon)}`
}

function openPassage(step: SermonStep | undefined): void {
  if (!step?.passage) return
  const parsed = parseRef(step.passage)
  if (!parsed) return
  go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)
}

function applyLive(sermon: Sermon | null): void {
  const following = state.following
  let nextFollow = following
  if (following?.mode === 'live') {
    if (!sermon || sermon.id !== following.sermonId) {
      nextFollow = { ...following, mode: 'review', withPastor: false }
    } else if (sermon.currentStep !== following.sermon.currentStep) {
      const step = clamp(sermon.currentStep, sermon.steps.length)
      nextFollow = { ...following, sermon, step, withPastor: true }
      openPassage(sermon.steps[step])
    } else {
      const step = clamp(following.step, sermon.steps.length)
      nextFollow = { ...following, sermon, step, withPastor: step === sermon.currentStep }
    }
  } else if (following && sermon && following.sermonId === sermon.id) {
    nextFollow = { ...following, sermon, step: clamp(following.step, sermon.steps.length) }
  }
  if (sermonKey(state.live) === sermonKey(sermon) && followKey(following) === followKey(nextFollow)) return
  state = { live: sermon, following: nextFollow }
  emit()
}

async function pull(): Promise<void> {
  const gen = ++pollGen
  const token = watchToken
  try {
    const sermon = await loadLive()
    if (gen !== pollGen || token !== watchToken) return
    applyLive(sermon)
  } catch {
    // The banner can wait for the next poll.
  }
}

function schedule(token: number): void {
  window.setTimeout(() => {
    if (token !== watchToken || !watchEnabled) return
    void pull().finally(() => {
      if (token === watchToken && watchEnabled) schedule(token)
    })
  }, watchFast ? 2000 : 8000)
}

export function setLiveWatch(enabled: boolean, fast: boolean): void {
  if (watchEnabled === enabled && watchFast === fast) return
  watchEnabled = enabled
  watchFast = fast
  watchToken += 1
  if (!enabled) {
    if (state.live || state.following) {
      state = empty
      emit()
    }
    return
  }
  const token = watchToken
  void pull().finally(() => {
    if (token === watchToken && watchEnabled) schedule(token)
  })
}

export async function refreshLive(): Promise<void> {
  if (!watchEnabled) return
  await pull()
}

export function followSermon(sermon: Sermon): void {
  const step = clamp(sermon.currentStep, sermon.steps.length)
  const live = sermon.status === 'live'
  state = {
    live: live ? sermon : state.live,
    following: {
      sermonId: sermon.id,
      mode: live ? 'live' : 'review',
      step,
      withPastor: live,
      sermon,
    },
  }
  emit()
  openPassage(sermon.steps[step])
}

export function followLive(): void {
  const sermon = state.live
  if (!sermon) return
  followSermon(sermon)
}

export function reviewSermon(sermon: Sermon, index = 0): void {
  const step = clamp(index, sermon.steps.length)
  state = {
    ...state,
    following: { sermonId: sermon.id, mode: 'review', step, withPastor: false, sermon },
  }
  emit()
  openPassage(sermon.steps[step])
}

export function browseStep(index: number): void {
  const following = state.following
  if (!following) return
  if (index < 0 || index >= following.sermon.steps.length) return
  const withPastor = following.mode === 'live' && index === following.sermon.currentStep
  state = { ...state, following: { ...following, step: index, withPastor } }
  emit()
  openPassage(following.sermon.steps[index])
}

export function rejoinPastor(): void {
  const following = state.following
  const live = state.live
  if (!following || following.mode !== 'live' || !live || live.id !== following.sermonId) return
  const step = clamp(live.currentStep, live.steps.length)
  state = {
    ...state,
    following: { ...following, sermon: live, step, withPastor: true },
  }
  emit()
  openPassage(live.steps[step])
}

export async function pastorMove(index: number): Promise<void> {
  const following = state.following
  if (!following) return
  if (index < 0 || index >= following.sermon.steps.length) return
  await controlSermon(following.sermonId, { action: 'step', step: index })
  const sermon = { ...following.sermon, currentStep: index }
  state = {
    live: state.live?.id === sermon.id ? sermon : state.live,
    following: { ...following, mode: 'live', sermon, step: index, withPastor: true },
  }
  emit()
  openPassage(sermon.steps[index])
  void pull()
}

export function leaveFollow(): void {
  if (!state.following) return
  state = { ...state, following: null }
  emit()
}
