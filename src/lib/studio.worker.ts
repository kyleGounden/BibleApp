import { KokoroTTS } from 'kokoro-js'
import { env, type ProgressInfo } from '@huggingface/transformers'

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

function loadModel(): Promise<KokoroTTS> {
  if (!loading) {
    lastPercent = -1
    report('Preparing the voice')
    loading = (async () => {
      env.allowLocalModels = false
      const wasm = env.backends.onnx.wasm
      if (wasm) wasm.numThreads = 1
      return KokoroTTS.from_pretrained(MODEL, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: onProgress,
      })
    })()
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
