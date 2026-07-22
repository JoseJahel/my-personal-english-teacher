/**
 * Cliente del worker de inferencia para el hilo principal: crea el Web
 * Worker orquestador (`inference-worker.ts`), correlaciona pedidos y
 * respuestas por `requestId`, y expone una API basada en promesas sin ningún
 * import de React. Esta capa es infraestructura pura de `ia/`, tal como
 * `audio/microphone-capture.ts` lo es de `audio/`: nada de aquí sabe que
 * existe `ui/`.
 */

import type {
  GrammarCorrectionErrorReason,
  InferenceWorkerRequestMessage,
  InferenceWorkerResponseMessage,
  ModelLoadingProgressMessage,
  TranscriptionErrorReason,
} from './inference-worker-protocol'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'

/**
 * Motivos por los que puede fallar `InferenceClient.transcribe` o
 * `InferenceClient.correctGrammar`. Extiende los motivos que reporta el
 * worker (`TranscriptionErrorReason`, `GrammarCorrectionErrorReason`) con uno
 * propio del hilo principal, `'worker-unavailable'`, para cuando el propio
 * Worker termina inesperadamente (evento `error`) o el cliente ya fue
 * liberado antes de responder.
 */
export type InferenceClientErrorReason =
  TranscriptionErrorReason | GrammarCorrectionErrorReason | 'worker-unavailable'

/**
 * Error de primera clase para fallos de transcripción, análogo a
 * `MicrophoneCaptureError` de `audio/microphone-capture.ts`: `ui/` inspecciona
 * `reason` (tipado) en vez de interpretar mensajes de texto libre para
 * decidir qué mostrar.
 */
export class InferenceClientError extends Error {
  readonly reason: InferenceClientErrorReason

  constructor(reason: InferenceClientErrorReason, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'InferenceClientError'
    this.reason = reason
  }
}

/** Función que recibe cada evento de progreso de descarga de un modelo. */
export type ModelLoadingProgressListener = (message: ModelLoadingProgressMessage) => void

/** Función que cancela una suscripción previa a `subscribeToModelLoadingProgress`. */
export type UnsubscribeFromModelLoadingProgress = () => void

/** Cliente del worker de inferencia, devuelto por `createInferenceClient`. */
export interface InferenceClient {
  /**
   * Transcribe un segmento de audio mono a 16 kHz (ver
   * `resampleToWhisperRate` en `audio/audio-resampler.ts`). El `Float32Array`
   * se transfiere al worker (no se copia): no debe volver a leerse desde el
   * hilo principal después de llamar a esta función.
   */
  transcribe: (samples16kHz: Float32Array) => Promise<string>
  /**
   * Corrige la gramática de un texto en inglés (segunda etapa del pipeline,
   * post-ASR: ver `ia/grammar-correction.ts`).
   */
  correctGrammar: (englishText: string) => Promise<string>
  /**
   * Suscribe un listener al progreso de descarga de cualquiera de los
   * modelos del worker (ASR o corrección gramatical); el propio mensaje trae
   * `modelKey` para distinguir de cuál se trata.
   */
  subscribeToModelLoadingProgress: (
    listener: ModelLoadingProgressListener,
  ) => UnsubscribeFromModelLoadingProgress
  /**
   * Termina el Worker y rechaza cualquier solicitud pendiente (transcripción
   * o corrección gramatical) con `InferenceClientError('worker-unavailable',
   * ...)`. Es idempotente: llamarla más de una vez no tiene efecto adicional.
   */
  dispose: () => void
}

/**
 * Solicitud pendiente de respuesta del worker, correlacionada por
 * `requestId`. Se reutiliza tanto para `'transcribe'` como para
 * `'correct-grammar'`: ambas resuelven con un texto plano (transcrito o
 * corregido, respectivamente), así que comparten la misma forma.
 */
interface PendingInferenceRequest {
  resolve: (resultText: string) => void
  reject: (error: InferenceClientError) => void
}

/**
 * Crea un nuevo cliente del worker de inferencia. Arma el Worker como módulo
 * ES (`type: 'module'`) para poder usar `import`/`export` dentro de
 * `inference-worker.ts`, tal como requiere `@huggingface/transformers`.
 */
export function createInferenceClient(): InferenceClient {
  const worker = new Worker(new URL('./inference-worker.ts', import.meta.url), {
    type: 'module',
  })

  const pendingRequests = new Map<string, PendingInferenceRequest>()
  const progressListeners = new Set<ModelLoadingProgressListener>()
  let isDisposed = false

  worker.addEventListener('message', (event: MessageEvent<InferenceWorkerResponseMessage>) => {
    const message = event.data

    switch (message.type) {
      case 'model-loading-progress':
        for (const listener of progressListeners) {
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
              `La transcripción falló con el motivo '${message.reason}'.`,
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
              `La corrección gramatical falló con el motivo '${message.reason}'.`,
            ),
          )
        pendingRequests.delete(message.requestId)
        break
    }
  })

  worker.addEventListener('error', (event: ErrorEvent) => {
    // Un error no capturado dentro del worker (por ejemplo, al inicializar
    // ONNX Runtime Web) no trae un requestId: se rechazan todas las
    // solicitudes pendientes, porque no hay forma de saber a cuál pertenece.
    const workerError = new InferenceClientError(
      'worker-unavailable',
      'El worker de inferencia terminó inesperadamente.',
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
          'El cliente de inferencia ya fue liberado (dispose()).',
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
          'El cliente de inferencia ya fue liberado (dispose()).',
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

  function dispose(): void {
    if (isDisposed) {
      return
    }
    isDisposed = true

    const disposalError = new InferenceClientError(
      'worker-unavailable',
      'El cliente de inferencia fue liberado con solicitudes pendientes.',
    )
    for (const pendingRequest of pendingRequests.values()) {
      pendingRequest.reject(disposalError)
    }
    pendingRequests.clear()
    progressListeners.clear()

    worker.terminate()
  }

  return { transcribe, correctGrammar, subscribeToModelLoadingProgress, dispose }
}
