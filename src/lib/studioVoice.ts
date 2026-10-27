// Kokoro runs in the browser (Apache-2.0). The weights download on first use
// and then stay in the browser cache. English only.

export const STUDIO_VOICES = [
  { id: 'af_heart', label: 'Heart — warm American' },
  { id: 'af_bella', label: 'Bella — softer American' },
  { id: 'bf_emma', label: 'Emma — British' },
  { id: 'am_michael', label: 'Michael — American narrator' },
  { id: 'bm_george', label: 'George — steady British' },
] as const

export type StudioVoiceId = (typeof STUDIO_VOICES)[number]['id']

const STUDIO_PREFIX = 'studio:'
const CACHE_MAX = 12

export type StudioWord = { start: number; end: number; at: number }

export type StudioClip = {
  samples: Float32Array
  sampleRate: number
  words: StudioWord[]
}

type Live = {
  ctx: AudioContext
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer
  clip: StudioClip
  offset: number
  startedAt: number
  onWord: (at: number) => void
  onEnd: () => void
  onStart: () => void
  timer: number
  suppress: boolean
  follower: Live | null
}

type WorkerClip = { samples: Float32Array; sampleRate: number }

type WorkerOut =
  | { type: 'progress'; label: string }
  | { type: 'clip'; id: number; samples: Float32Array; sampleRate: number }
  | { type: 'error'; id: number; message: string }

let audioCtx: AudioContext | null = null
let live: Live | null = null
let worker: Worker | null = null
let nextJob = 1
const jobs = new Map<number, { resolve: (clip: WorkerClip) => void; reject: (error: Error) => void }>()
const progressListeners = new Set<(label: string) => void>()
const cache = new Map<string, Promise<StudioClip>>()
const ready = new Set<string>()

export function onStudioProgress(listener: (label: string) => void): () => void {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

function emitProgress(label: string): void {
  progressListeners.forEach((listener) => listener(label))
}

function failJobs(message: string): void {
  const error = new Error(message)
  for (const job of jobs.values()) job.reject(error)
  jobs.clear()
}

function studioWorker(): Worker {
  if (worker) return worker
  const next = new Worker(new URL('./studio.worker.ts', import.meta.url), { type: 'module' })
  next.onmessage = (event: MessageEvent<WorkerOut>) => {
    const message = event.data
    if (!message || message.type === 'progress') {
      if (message?.type === 'progress') emitProgress(message.label)
      return
    }
    const job = jobs.get(message.id)
    if (!job) return
    jobs.delete(message.id)
    if (message.type === 'clip') job.resolve({ samples: message.samples, sampleRate: message.sampleRate })
    else job.reject(new Error(message.message))
  }
  next.onerror = () => {
    failJobs('The studio voice did not load.')
    worker = null
  }
  worker = next
  return next
}

function generateClip(voice: StudioVoiceId, speed: number, text: string): Promise<WorkerClip> {
  const id = nextJob
  nextJob += 1
  return new Promise((resolve, reject) => {
    jobs.set(id, { resolve, reject })
    studioWorker().postMessage({ type: 'generate', id, voice, speed, text })
  })
}

export function studioId(name: string): StudioVoiceId | null {
  if (!name.startsWith(STUDIO_PREFIX)) return null
  const id = name.slice(STUDIO_PREFIX.length)
  return STUDIO_VOICES.some((voice) => voice.id === id) ? (id as StudioVoiceId) : null
}

export function studioChoice(id: StudioVoiceId): string {
  return `${STUDIO_PREFIX}${id}`
}

function context(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

export function primeStudioAudio(): void {
  try {
    void context().resume()
  } catch {
    /* playback falls back to the device voice */
  }
}

export function warmupStudio(): void {
  studioWorker().postMessage({ type: 'warmup' })
}

function cacheKey(voice: StudioVoiceId, speed: number, text: string): string {
  return `${voice}\n${speed}\n${text}`
}

export function clipIsReady(voice: StudioVoiceId, speed: number, text: string): boolean {
  return ready.has(cacheKey(voice, speed, text))
}

function remember(key: string, job: Promise<StudioClip>): void {
  cache.set(key, job)
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest == null) break
    cache.delete(oldest)
    ready.delete(oldest)
  }
}

function wordsIn(text: string, duration: number, offset: number, base: number): StudioWord[] {
  const words: StudioWord[] = []
  const chars = Math.max(text.length, 1)
  for (const match of text.matchAll(/\S+/g)) {
    const index = match.index ?? 0
    words.push({
      start: offset + (index / chars) * duration,
      end: offset + ((index + match[0].length) / chars) * duration,
      at: base + index,
    })
  }
  return words
}

async function synthesize(voice: StudioVoiceId, speed: number, text: string): Promise<StudioClip> {
  const audio = await generateClip(voice, speed, text)
  if (!audio.samples.length) throw new Error('The studio voice returned no audio.')
  const duration = audio.samples.length / audio.sampleRate
  return { samples: audio.samples, sampleRate: audio.sampleRate, words: wordsIn(text, duration, 0, 0) }
}

export function prepareClip(voice: StudioVoiceId, speed: number, text: string): Promise<StudioClip> {
  const key = cacheKey(voice, speed, text)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    remember(key, hit)
    return hit
  }
  const job = synthesize(voice, speed, text).then(
    (clip) => {
      ready.add(key)
      return clip
    },
    (error: unknown) => {
      cache.delete(key)
      ready.delete(key)
      throw error
    },
  )
  remember(key, job)
  return job
}

function wordAt(clip: StudioClip, seconds: number): number {
  let at = 0
  for (const word of clip.words) {
    if (word.start <= seconds) at = word.at
    else break
  }
  return at
}

function armTimer(state: Live): void {
  window.clearInterval(state.timer)
  state.timer = window.setInterval(() => {
    if (live !== state || !state.source || state.suppress) return
    const heard = state.offset + (state.ctx.currentTime - state.startedAt)
    if (heard < 0) return
    state.onWord(wordAt(state.clip, heard))
  }, 80)
}

function bindEnd(state: Live, source: AudioBufferSourceNode): void {
  source.onended = () => {
    if (state.source !== source) return
    state.source = null
    window.clearInterval(state.timer)
    if (state.suppress) return
    const next = state.follower
    if (next?.source && !next.suppress) {
      state.follower = null
      state.suppress = true
      live = next
      next.onStart()
      armTimer(next)
      return
    }
    state.suppress = true
    if (live === state) live = null
    state.onEnd()
  }
}

function startSource(state: Live): void {
  window.clearInterval(state.timer)
  const source = state.ctx.createBufferSource()
  source.buffer = state.buffer
  source.connect(state.ctx.destination)
  state.source = source
  state.startedAt = state.ctx.currentTime
  bindEnd(state, source)
  armTimer(state)
  source.start(0, state.offset)
}

function makeLive(
  ctx: AudioContext,
  clip: StudioClip,
  onWord: (at: number) => void,
  onEnd: () => void,
  onStart: () => void,
): Live | null {
  if (clip.samples.length < 2) return null
  const buffer = ctx.createBuffer(1, clip.samples.length, clip.sampleRate)
  const data = buffer.getChannelData(0)
  data.set(clip.samples)
  const fade = Math.min(Math.floor(data.length / 2), Math.round(clip.sampleRate * 0.008))
  for (let i = 0; i < fade; i += 1) {
    const gain = i / fade
    data[i] *= gain
    data[data.length - 1 - i] *= gain
  }
  return {
    ctx,
    source: null,
    buffer,
    clip,
    offset: 0,
    startedAt: 0,
    onWord,
    onEnd,
    onStart,
    timer: 0,
    suppress: false,
    follower: null,
  }
}

function dropFollower(state: Live): void {
  const next = state.follower
  if (!next) return
  state.follower = null
  dropFollower(next)
  next.suppress = true
  window.clearInterval(next.timer)
  const source = next.source
  next.source = null
  try {
    source?.stop()
  } catch {
    /* not playing yet */
  }
  source?.disconnect()
}

export function followerCount(): number {
  let count = 0
  let state = live
  while (state?.follower) {
    count += 1
    state = state.follower
  }
  return count
}

export function playClip(clip: StudioClip, onWord: (at: number) => void, onEnd: () => void): void {
  stopClip()
  const ctx = context()
  void ctx.resume()
  const state = makeLive(ctx, clip, onWord, onEnd, () => undefined)
  if (!state) {
    onEnd()
    return
  }
  live = state
  startSource(state)
}

// Schedule the next clip to start as the current one finishes, so the
// join is on the audio clock instead of after a round trip through JavaScript.
export function followClip(
  clip: StudioClip,
  onWord: (at: number) => void,
  onEnd: () => void,
  gapSec: number,
  onStart: () => void,
): (() => void) | null {
  const root = live
  if (!root?.source || root.suppress) return null
  let state = root
  while (state.follower && !state.follower.suppress) state = state.follower
  if (!state.source || state.suppress) return null
  const ahead = state.startedAt - state.ctx.currentTime
  const elapsed = ahead > 0.01 ? 0 : Math.max(0, state.ctx.currentTime - state.startedAt)
  const remain = state.buffer.duration - state.offset - elapsed
  if (remain < 0.05) return null
  const next = makeLive(state.ctx, clip, onWord, onEnd, onStart)
  if (!next) return null
  const when = (ahead > 0.01 ? state.startedAt : state.ctx.currentTime) + remain + Math.max(0, gapSec)
  next.startedAt = when
  const source = state.ctx.createBufferSource()
  source.buffer = next.buffer
  source.connect(state.ctx.destination)
  next.source = source
  bindEnd(next, source)
  state.follower = next
  source.start(when)
  return () => {
    if (state.follower === next) dropFollower(state)
  }
}

export function pauseClip(): boolean {
  const state = live
  if (!state?.source || state.suppress) return false
  dropFollower(state)
  const heard = state.offset + (state.ctx.currentTime - state.startedAt)
  state.offset = Math.min(state.buffer.duration, Math.max(0, heard))
  window.clearInterval(state.timer)
  state.suppress = true
  const source = state.source
  state.source = null
  try {
    source.stop()
  } catch {
    /* already stopped */
  }
  source.disconnect()
  return true
}

export function resumeClip(): boolean {
  const state = live
  if (!state || state.source) return false
  if (state.offset >= state.buffer.duration - 0.05) return false
  state.suppress = false
  void state.ctx.resume()
  startSource(state)
  return true
}

export function stopClip(): void {
  const state = live
  if (!state) return
  live = null
  dropFollower(state)
  window.clearInterval(state.timer)
  state.suppress = true
  const source = state.source
  state.source = null
  try {
    source?.stop()
  } catch {
    /* already stopped */
  }
  source?.disconnect()
}
