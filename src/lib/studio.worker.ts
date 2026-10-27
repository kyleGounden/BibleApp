import { KokoroTTS } from 'kokoro-js'
import { env, type ProgressInfo } from '@huggingface/transformers'
import ortWasm from '../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url'
import ortMjs from '../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url'

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'

type RequestMessage =
  | { type: 'warmup' }
  | { type: 'generate'; id: number; voice: string; speed: number; text: string }

type KokoroVoice = NonNullable<NonNullable<Parameters<KokoroTTS['generate']>[1]>['voice']>

type WorkerScope = {
  postMessage(message: unknown, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<RequestMessage>) => void) | null
}

const scope = globalThis as unknown as WorkerScope

let loading: Promise<KokoroTTS> | null = null
let chain: Promise<void> = Promise.resolve()
let lastPercent = -1

function report(label: string): void {
  scope.postMessage({ type: 'progress', label })
}

function onProgress(info: ProgressInfo): void {
  if (info.status === 'progress') {
    const percent = Math.round(info.progress)
    if (percent === lastPercent) return
    lastPercent = percent
    report(`Preparing the voice · ${percent}%`)
    return
  }
  if (info.status === 'initiate' || info.status === 'download') report('Preparing the voice')
}

function configureOrt(): void {
  env.allowLocalModels = false
  const wasm = env.backends.onnx.wasm
  if (!wasm) return
  // One thread, in this worker. A second worker needs cross-origin isolation,
  // which would block sign-in and the map. The runtime files come from this
  // site so the voice does not depend on a third-party script host.
  wasm.numThreads = 1
  wasm.proxy = false
  const origin = self.location?.href ?? import.meta.url
  wasm.wasmPaths = {
    wasm: new URL(ortWasm, origin).href,
    mjs: new URL(ortMjs, origin).href,
  }
}

async function createModel(): Promise<KokoroTTS> {
  configureOrt()
  // q8 on WebGPU comes out as static. The same weights on WASM speak clearly,
  // and they skip the long shader compile before the first word.
  return KokoroTTS.from_pretrained(MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: onProgress,
  })
}

function loadModel(): Promise<KokoroTTS> {
  if (!loading) {
    lastPercent = -1
    report('Preparing the voice')
    loading = createModel()
    loading.catch(() => {
      loading = null
    })
  }
  return loading
}

async function generate(message: Extract<RequestMessage, { type: 'generate' }>): Promise<void> {
  const model = await loadModel()
  const audio = await model.generate(message.text, {
    voice: message.voice as KokoroVoice,
    speed: message.speed,
  })
  const raw = audio.audio
  const samples = new Float32Array(raw.length)
  samples.set(raw)
  const sampleRate = audio.sampling_rate || 24000
  scope.postMessage({ type: 'clip', id: message.id, samples, sampleRate }, [samples.buffer])
}

function handle(message: RequestMessage): Promise<void> {
  if (message.type === 'warmup') {
    return loadModel().then(
      () => undefined,
      (error: unknown) => {
        const text = error instanceof Error ? error.message : 'The studio voice did not load.'
        scope.postMessage({ type: 'error', id: 0, message: text })
      },
    )
  }
  return generate(message).catch((error: unknown) => {
    const text = error instanceof Error ? error.message : 'The studio voice did not load.'
    scope.postMessage({ type: 'error', id: message.id, message: text })
  })
}

scope.onmessage = (event: MessageEvent<RequestMessage>) => {
  const message = event.data
  chain = chain.then(() => handle(message), () => handle(message))
}
