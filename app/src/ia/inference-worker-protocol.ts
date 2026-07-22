/**
 * Protocolo de mensajes tipado entre el hilo principal (`inference-client.ts`)
 * y el Web Worker orquestador de inferencia (`inference-worker.ts`). Vive en
 * su propio archivo para que ambos lados importen los mismos tipos en vez de
 * duplicarlos: un cambio en la forma de un mensaje se refleja en un único
 * lugar y el compilador avisa si alguno de los dos extremos queda
 * desincronizado.
 *
 * Todos los mensajes son objetos planos serializables por structured clone.
 * `audioSamples`, en la dirección hilo principal → worker, viaja además como
 * transferable (ver `inference-client.ts`), para evitar copiar el buffer de
 * audio completo en cada solicitud.
 */

import type { ModelRegistryKey } from './model-registry'

/**
 * Pide transcribir un segmento de audio ya resampleado a 16 kHz mono (ver
 * `audio/audio-resampler.ts`). `sampleRate` viaja explícito -en vez de
 * asumirse implícitamente- para que el worker pueda validarlo y responder con
 * un error de primera clase si llegara audio a otra tasa.
 */
export interface TranscribeRequestMessage {
  readonly type: 'transcribe'
  /** Identificador único de esta solicitud, para correlacionar la respuesta. */
  readonly requestId: string
  readonly audioSamples: Float32Array
  readonly sampleRate: number
}

/** Unión de todos los mensajes que el hilo principal puede enviar al worker. */
export type InferenceWorkerRequestMessage = TranscribeRequestMessage

/**
 * Progreso de descarga de un modelo, reenviado desde el `progress_callback`
 * de `transformers.js` (ver `automatic-speech-recognition.ts`). Solo se
 * emite mientras el modelo se está descargando (típicamente, en el primer
 * uso): las transcripciones siguientes, con el modelo ya en la Cache API del
 * navegador, no generan estos mensajes.
 */
export interface ModelLoadingProgressMessage {
  readonly type: 'model-loading-progress'
  /** Qué modelo del registro (`model-registry.ts`) se está descargando. */
  readonly modelKey: ModelRegistryKey
  /** Porcentaje de avance de descarga del archivo actual, entre 0 y 100. */
  readonly progressPercent: number
  /** Nombre del archivo del modelo que se está descargando. */
  readonly fileName: string
}

/** Resultado exitoso de una solicitud `'transcribe'`. */
export interface TranscriptionResultMessage {
  readonly type: 'transcription-result'
  readonly requestId: string
  readonly transcribedText: string
}

/**
 * Motivos por los que puede fallar una transcripción, en el mismo espíritu
 * que `MicrophoneCaptureErrorReason` de `audio/microphone-capture.ts`: un
 * discriminante de cadena (no un enum: `erasableSyntaxOnly` los prohíbe en
 * este proyecto) para que `ui/` mapee cada valor a un mensaje propio con un
 * simple `switch`.
 *
 * - `'invalid-sample-rate'`: el audio recibido no está a 16 kHz.
 * - `'model-load-failed'`: no fue posible descargar o inicializar el
 *   pipeline de ASR (ni siquiera con el fallback de WASM).
 * - `'transcription-failed'`: el modelo cargó correctamente, pero la
 *   inferencia sobre el audio recibido falló.
 */
export type TranscriptionErrorReason =
  'invalid-sample-rate' | 'model-load-failed' | 'transcription-failed'

/** Resultado fallido de una solicitud `'transcribe'`. */
export interface TranscriptionErrorMessage {
  readonly type: 'transcription-error'
  readonly requestId: string
  readonly reason: TranscriptionErrorReason
}

/** Unión de todos los mensajes que el worker puede enviar al hilo principal. */
export type InferenceWorkerResponseMessage =
  ModelLoadingProgressMessage | TranscriptionResultMessage | TranscriptionErrorMessage
