import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { env } from '@huggingface/transformers'
import { KokoroTTS } from 'kokoro-js'
import { dataDirectory } from './sqlite.js'

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'

export const TTS_VOICES = ['af_heart', 'af_bella', 'bf_emma', 'am_michael', 'bm_george'] as const
export type TtsVoiceId = (typeof TTS_VOICES)[number]

const VOICE_SET = new Set<string>(TTS_VOICES)

let loading: Promise<KokoroTTS> | null = null
let chain: Promise<unknown> = Promise.resolve()

function ttsDirectory(): string {
  const dir = join(dataDirectory(), 'tts')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** App-pool identity can write .data, not node_modules — keep HF weights there. */
function configureModelCache(): void {
  const dir = join(dataDirectory(), 'hf-cache')
  mkdirSync(dir, { recursive: true })
  env.cacheDir = dir
  process.env.HF_HOME = dir
  process.env.TRANSFORMERS_CACHE = dir
}

export function isTtsVoice(value: string): value is TtsVoiceId {
  return VOICE_SET.has(value)
}

export function clipHash(voice: string, speed: number, text: string): string {
  return createHash('sha256').update(`${voice}\n${speed}\n${text}`).digest('hex')
}

function wavPath(hash: string): string {
  return join(ttsDirectory(), `${hash}.wav`)
}

export function clipCached(voice: string, speed: number, text: string): boolean {
  return existsSync(wavPath(clipHash(voice, speed, text)))
}

export function readCachedClip(voice: string, speed: number, text: string): Buffer | null {
  const file = wavPath(clipHash(voice, speed, text))
  if (!existsSync(file)) return null
  return readFileSync(file)
}

function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const dataSize = samples.length * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0))
    buffer.writeInt16LE((sample < 0 ? sample * 0x8000 : sample * 0x7fff) | 0, offset)
    offset += 2
  }
  return buffer
}

async function loadModel(): Promise<KokoroTTS> {
  if (!loading) {
    configureModelCache()
    loading = KokoroTTS.from_pretrained(MODEL, {
      dtype: 'q8',
      device: 'cpu',
    })
    loading.catch(() => {
      loading = null
    })
  }
  return loading
}

async function synthesize(voice: TtsVoiceId, speed: number, text: string): Promise<Buffer> {
  const model = await loadModel()
  const audio = await model.generate(text, { voice, speed })
  const raw = audio.audio
  const samples = raw instanceof Float32Array ? raw : new Float32Array(raw)
  const sampleRate = audio.sampling_rate || 24000
  if (!samples.length) throw new Error('The studio voice returned no audio.')
  const wav = encodeWav(samples, sampleRate)
  writeFileSync(wavPath(clipHash(voice, speed, text)), wav)
  return wav
}

export function getOrCreateClip(voice: TtsVoiceId, speed: number, text: string): Promise<Buffer> {
  const cached = readCachedClip(voice, speed, text)
  if (cached) return Promise.resolve(cached)
  const job = chain.then(() => {
    const again = readCachedClip(voice, speed, text)
    if (again) return again
    return synthesize(voice, speed, text)
  })
  chain = job.then(
    () => undefined,
    () => undefined,
  )
  return job
}

export function warmupTts(): void {
  void loadModel().catch(() => undefined)
}
