/**
 * Main-thread client for the inference worker: promise API, requestId
 * correlation, model progress/ready listeners. No React imports.
 */

import type {
  GrammarCorrectionErrorReason,
  InferenceWorkerRequestMessage,
  InferenceWorkerResponseMessage,
  ModelLoadingProgressMessage,
  ModelReadyMessage,
  TranscriptionErrorReason,
} from './inference-worker-protocol'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'

export type InferenceClientErrorReason =
  | TranscriptionErrorReason
  | GrammarCorrectionErrorReason
  | 'worker-unavailable'

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
  subscribeToModelLoadingProgress: (
    listener: ModelLoadingProgressListener,
  ) => UnsubscribeFromModelLoadingProgress
  subscribeToModelReady: (listener: ModelReadyListener) => UnsubscribeFromModelReady
  /** Terminates the worker and rejects pending requests. Idempotent. */
  dispose: () => void
}

interface PendingInferenceRequest {
  resolve: (resultText: string) => void
  reject: (error: InferenceClientError) => void
}

/** Creates a module worker backed inference client. */
export function createInferenceClient(): InferenceClient {
  const worker = new Worker(new URL('./inference-worker.ts', import.meta.url), {
    type: 'module',
  })

  const pendingRequests = new Map<string, PendingInferenceRequest>()
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
        pendingRequests.get(message.requestId)?.resolve(message.transcribedText)
        pendingRequests.delete(message.requestId)
        break
      case 'transcription-error':
        pendingRequests
          .get(message.requestId)
          ?.reject(
            new InferenceClientError(
              message.reason,
              `Transcription failed with reason '${message.reason}'.`,
            ),
          )
        pendingRequests.delete(message.requestId)
        break
      case 'grammar-correction-result':
        pendingRequests.get(message.requestId)?.resolve(message.correctedText)
        pendingRequests.delete(message.requestId)
        break
      case 'grammar-correction-error':
        pendingRequests
          .get(message.requestId)
          ?.reject(
            new InferenceClientError(
              message.reason,
              `Grammar correction failed with reason '${message.reason}'.`,
            ),
          )
        pendingRequests.delete(message.requestId)
        break
    }
  })

  worker.addEventListener('error', (event: ErrorEvent) => {
    // Worker-level failures have no requestId: reject every pending request.
    const workerError = new InferenceClientError(
      'worker-unavailable',
      'Inference worker terminated unexpectedly.',
      { cause: event.error },
    )
    for (const pendingRequest of pendingRequests.values()) {
      pendingRequest.reject(workerError)
    }
    pendingRequests.clear()
  })

  function transcribe(samples16kHz: Float32Array): Promise<string> {
    if (isDisposed) {
      return Promise.reject(
        new InferenceClientError(
          'worker-unavailable',
          'Inference client was already disposed.',
        ),
      )
    }

    const requestId = crypto.randomUUID()

    return new Promise<string>((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject })

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
    if (isDisposed) {
      return Promise.reject(
        new InferenceClientError(
          'worker-unavailable',
          'Inference client was already disposed.',
        ),
      )
    }

    const requestId = crypto.randomUUID()

    return new Promise<string>((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject })

      const message: InferenceWorkerRequestMessage = {
        type: 'correct-grammar',
        requestId,
        inputText: englishText,
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
    for (const pendingRequest of pendingRequests.values()) {
      pendingRequest.reject(disposalError)
    }
    pendingRequests.clear()
    progressListeners.clear()
    modelReadyListeners.clear()

    worker.terminate()
  }

  return {
    transcribe,
    correctGrammar,
    subscribeToModelLoadingProgress,
    subscribeToModelReady,
    dispose,
  }
}
