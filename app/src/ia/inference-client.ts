/**
 * Main-thread client for the inference worker: promise API, requestId
 * correlation, model progress/ready listeners. No React imports.
 */

import type {
  GenerateTutorReplyErrorReason,
  GrammarCorrectionErrorReason,
  InferenceWorkerRequestMessage,
  InferenceWorkerResponseMessage,
  ModelLoadingProgressMessage,
  ModelReadyMessage,
  PreloadModelsErrorReason,
  SynthesizeSpeechErrorReason,
  TranscriptionErrorReason,
} from './inference-worker-protocol'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'

export type InferenceClientErrorReason =
  | TranscriptionErrorReason
  | GrammarCorrectionErrorReason
  | PreloadModelsErrorReason
  | SynthesizeSpeechErrorReason
  | GenerateTutorReplyErrorReason
  | 'worker-unavailable'

export interface SynthesizedSpeechResult {
  readonly samples: Float32Array
  readonly sampleRateInHertz: number
}

export interface TutorReplyResult {
  readonly tutorReplyText: string
  readonly usedFallback: boolean
}

export interface GenerateTutorReplyInput {
  readonly scenarioContextEn: string
  readonly lastTutorLineEn: string
  readonly userUtteranceEn: string
  readonly fallbackReplyEn: string
}

/** First-class client error; UI maps `reason`, not free-form message text. */
export class InferenceClientError extends Error {
  readonly reason: InferenceClientErrorReason

  constructor(reason: InferenceClientErrorReason, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'InferenceClientError'
    this.reason = reason
  }
}

export type ModelLoadingProgressListener = (message: ModelLoadingProgressMessage) => void
export type UnsubscribeFromModelLoadingProgress = () => void
export type ModelReadyListener = (message: ModelReadyMessage) => void
export type UnsubscribeFromModelReady = () => void

export interface InferenceClient {
  /** Transfers `samples16kHz` buffer to the worker (do not read it after). */
  transcribe: (samples16kHz: Float32Array) => Promise<string>
  correctGrammar: (englishText: string) => Promise<string>
  /** SpeechT5 TTS; loads on first call (not part of warm preload). */
  synthesizeSpeech: (englishText: string) => Promise<SynthesizedSpeechResult>
  /** SmolLM2 tutor reply; loads on first call; falls back to scenario line on soft failure. */
  generateTutorReply: (input: GenerateTutorReplyInput) => Promise<TutorReplyResult>
  /** Warm-load Whisper + T5 in the worker (progress events still fire). */
  preloadModels: () => Promise<void>
  subscribeToModelLoadingProgress: (
    listener: ModelLoadingProgressListener,
  ) => UnsubscribeFromModelLoadingProgress
  subscribeToModelReady: (listener: ModelReadyListener) => UnsubscribeFromModelReady
  /** Terminates the worker and rejects pending requests. Idempotent. */
  dispose: () => void
}

interface PendingTextRequest {
  resolve: (resultText: string) => void
  reject: (error: InferenceClientError) => void
}

interface PendingSpeechRequest {
  resolve: (result: SynthesizedSpeechResult) => void
  reject: (error: InferenceClientError) => void
}

interface PendingTutorReplyRequest {
  resolve: (result: TutorReplyResult) => void
  reject: (error: InferenceClientError) => void
}

interface PendingVoidRequest {
  resolve: () => void
  reject: (error: InferenceClientError) => void
}

/** Creates a module worker backed inference client. */
export function createInferenceClient(): InferenceClient {
  const worker = new Worker(new URL('./inference-worker.ts', import.meta.url), {
    type: 'module',
  })

  const pendingTextRequests = new Map<string, PendingTextRequest>()
  const pendingSpeechRequests = new Map<string, PendingSpeechRequest>()
  const pendingTutorReplyRequests = new Map<string, PendingTutorReplyRequest>()
  const pendingVoidRequests = new Map<string, PendingVoidRequest>()
  const progressListeners = new Set<ModelLoadingProgressListener>()
  const modelReadyListeners = new Set<ModelReadyListener>()
  let isDisposed = false

  worker.addEventListener('message', (event: MessageEvent<InferenceWorkerResponseMessage>) => {
    const message = event.data

    switch (message.type) {
      case 'model-loading-progress':
        for (const listener of progressListeners) {
          listener(message)
        }
        break
      case 'model-ready':
        for (const listener of modelReadyListeners) {
          listener(message)
        }
        break
      case 'transcription-result':
        pendingTextRequests.get(message.requestId)?.resolve(message.transcribedText)
        pendingTextRequests.delete(message.requestId)
        break
      case 'transcription-error':
        pendingTextRequests
          .get(message.requestId)
          ?.reject(
            new InferenceClientError(
              message.reason,
              `Transcription failed with reason '${message.reason}'.`,
            ),
          )
        pendingTextRequests.delete(message.requestId)
        break
      case 'grammar-correction-result':
        pendingTextRequests.get(message.requestId)?.resolve(message.correctedText)
        pendingTextRequests.delete(message.requestId)
        break
      case 'grammar-correction-error':
        pendingTextRequests
          .get(message.requestId)
          ?.reject(
            new InferenceClientError(
              message.reason,
              `Grammar correction failed with reason '${message.reason}'.`,
            ),
          )
        pendingTextRequests.delete(message.requestId)
        break
      case 'synthesize-speech-result':
        pendingSpeechRequests.get(message.requestId)?.resolve({
          samples: message.audioSamples,
          sampleRateInHertz: message.sampleRateInHertz,
        })
        pendingSpeechRequests.delete(message.requestId)
        break
      case 'synthesize-speech-error':
        pendingSpeechRequests
          .get(message.requestId)
          ?.reject(
            new InferenceClientError(
              message.reason,
              `Speech synthesis failed with reason '${message.reason}'.`,
            ),
          )
        pendingSpeechRequests.delete(message.requestId)
        break
      case 'generate-tutor-reply-result':
        pendingTutorReplyRequests.get(message.requestId)?.resolve({
          tutorReplyText: message.tutorReplyText,
          usedFallback: message.usedFallback,
        })
        pendingTutorReplyRequests.delete(message.requestId)
        break
      case 'generate-tutor-reply-error':
        pendingTutorReplyRequests
          .get(message.requestId)
          ?.reject(
            new InferenceClientError(
              message.reason,
              `Tutor reply generation failed with reason '${message.reason}'.`,
            ),
          )
        pendingTutorReplyRequests.delete(message.requestId)
        break
      case 'preload-models-result':
        pendingVoidRequests.get(message.requestId)?.resolve()
        pendingVoidRequests.delete(message.requestId)
        break
      case 'preload-models-error':
        pendingVoidRequests
          .get(message.requestId)
          ?.reject(
            new InferenceClientError(
              message.reason,
              `Model preload failed with reason '${message.reason}'.`,
            ),
          )
        pendingVoidRequests.delete(message.requestId)
        break
    }
  })

  worker.addEventListener('error', (event: ErrorEvent) => {
    const workerError = new InferenceClientError(
      'worker-unavailable',
      'Inference worker terminated unexpectedly.',
      { cause: event.error },
    )
    for (const pendingRequest of pendingTextRequests.values()) {
      pendingRequest.reject(workerError)
    }
    pendingTextRequests.clear()
    for (const pendingRequest of pendingSpeechRequests.values()) {
      pendingRequest.reject(workerError)
    }
    pendingSpeechRequests.clear()
    for (const pendingRequest of pendingTutorReplyRequests.values()) {
      pendingRequest.reject(workerError)
    }
    pendingTutorReplyRequests.clear()
    for (const pendingRequest of pendingVoidRequests.values()) {
      pendingRequest.reject(workerError)
    }
    pendingVoidRequests.clear()
  })

  function rejectIfDisposed(): InferenceClientError | null {
    if (!isDisposed) {
      return null
    }
    return new InferenceClientError(
      'worker-unavailable',
      'Inference client was already disposed.',
    )
  }

  function transcribe(samples16kHz: Float32Array): Promise<string> {
    const disposedError = rejectIfDisposed()
    if (disposedError) {
      return Promise.reject(disposedError)
    }

    const requestId = crypto.randomUUID()

    return new Promise<string>((resolve, reject) => {
      pendingTextRequests.set(requestId, { resolve, reject })

      const message: InferenceWorkerRequestMessage = {
        type: 'transcribe',
        requestId,
        audioSamples: samples16kHz,
        sampleRate: WHISPER_SAMPLE_RATE_IN_HERTZ,
      }

      worker.postMessage(message, [samples16kHz.buffer])
    })
  }

  function correctGrammar(englishText: string): Promise<string> {
    const disposedError = rejectIfDisposed()
    if (disposedError) {
      return Promise.reject(disposedError)
    }

    const requestId = crypto.randomUUID()

    return new Promise<string>((resolve, reject) => {
      pendingTextRequests.set(requestId, { resolve, reject })

      const message: InferenceWorkerRequestMessage = {
        type: 'correct-grammar',
        requestId,
        inputText: englishText,
      }

      worker.postMessage(message)
    })
  }

  function synthesizeSpeech(englishText: string): Promise<SynthesizedSpeechResult> {
    const disposedError = rejectIfDisposed()
    if (disposedError) {
      return Promise.reject(disposedError)
    }

    const requestId = crypto.randomUUID()

    return new Promise<SynthesizedSpeechResult>((resolve, reject) => {
      pendingSpeechRequests.set(requestId, { resolve, reject })

      const message: InferenceWorkerRequestMessage = {
        type: 'synthesize-speech',
        requestId,
        inputText: englishText,
      }

      worker.postMessage(message)
    })
  }

  function generateTutorReply(input: GenerateTutorReplyInput): Promise<TutorReplyResult> {
    const disposedError = rejectIfDisposed()
    if (disposedError) {
      return Promise.reject(disposedError)
    }

    const requestId = crypto.randomUUID()

    return new Promise<TutorReplyResult>((resolve, reject) => {
      pendingTutorReplyRequests.set(requestId, { resolve, reject })

      const message: InferenceWorkerRequestMessage = {
        type: 'generate-tutor-reply',
        requestId,
        scenarioContextEn: input.scenarioContextEn,
        lastTutorLineEn: input.lastTutorLineEn,
        userUtteranceEn: input.userUtteranceEn,
        fallbackReplyEn: input.fallbackReplyEn,
      }

      worker.postMessage(message)
    })
  }

  function preloadModels(): Promise<void> {
    const disposedError = rejectIfDisposed()
    if (disposedError) {
      return Promise.reject(disposedError)
    }

    const requestId = crypto.randomUUID()

    return new Promise<void>((resolve, reject) => {
      pendingVoidRequests.set(requestId, { resolve, reject })

      const message: InferenceWorkerRequestMessage = {
        type: 'preload-models',
        requestId,
      }

      worker.postMessage(message)
    })
  }

  function subscribeToModelLoadingProgress(
    listener: ModelLoadingProgressListener,
  ): UnsubscribeFromModelLoadingProgress {
    progressListeners.add(listener)
    return () => {
      progressListeners.delete(listener)
    }
  }

  function subscribeToModelReady(listener: ModelReadyListener): UnsubscribeFromModelReady {
    modelReadyListeners.add(listener)
    return () => {
      modelReadyListeners.delete(listener)
    }
  }

  function dispose(): void {
    if (isDisposed) {
      return
    }
    isDisposed = true

    const disposalError = new InferenceClientError(
      'worker-unavailable',
      'Inference client disposed while requests were still pending.',
    )
    for (const pendingRequest of pendingTextRequests.values()) {
      pendingRequest.reject(disposalError)
    }
    pendingTextRequests.clear()
    for (const pendingRequest of pendingSpeechRequests.values()) {
      pendingRequest.reject(disposalError)
    }
    pendingSpeechRequests.clear()
    for (const pendingRequest of pendingTutorReplyRequests.values()) {
      pendingRequest.reject(disposalError)
    }
    pendingTutorReplyRequests.clear()
    for (const pendingRequest of pendingVoidRequests.values()) {
      pendingRequest.reject(disposalError)
    }
    pendingVoidRequests.clear()
    progressListeners.clear()
    modelReadyListeners.clear()

    worker.terminate()
  }

  return {
    transcribe,
    correctGrammar,
    synthesizeSpeech,
    generateTutorReply,
    preloadModels,
    subscribeToModelLoadingProgress,
    subscribeToModelReady,
    dispose,
  }
}
