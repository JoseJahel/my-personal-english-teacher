/**
 * Typed main-thread ↔ inference-worker message protocol (structured clone).
 * Single shared shapes file so both ends stay in sync at compile time.
 */

import type { ModelRegistryKey } from './model-registry'

export interface TranscribeRequestMessage {
  readonly type: 'transcribe'
  readonly requestId: string
  readonly audioSamples: Float32Array
  /** Explicit so the worker can reject non-16 kHz audio with a typed reason. */
  readonly sampleRate: number
}

export interface CorrectGrammarRequestMessage {
  readonly type: 'correct-grammar'
  readonly requestId: string
  /** Raw ASR text; the worker adds the model's `grammar: ` prefix. */
  readonly inputText: string
}

/** Warm-load ASR + grammar so first stop does not pay the full download cost. */
export interface PreloadModelsRequestMessage {
  readonly type: 'preload-models'
  readonly requestId: string
}

export type InferenceWorkerRequestMessage =
  | TranscribeRequestMessage
  | CorrectGrammarRequestMessage
  | PreloadModelsRequestMessage

export interface ModelLoadingProgressMessage {
  readonly type: 'model-loading-progress'
  readonly modelKey: ModelRegistryKey
  /** Overall 0–100 across all files of this model (monotonic within a load). */
  readonly progressPercent: number
  readonly fileName: string
}

/** Emitted once load finishes so UI can leave the download progress state. */
export interface ModelReadyMessage {
  readonly type: 'model-ready'
  readonly modelKey: ModelRegistryKey
}

export interface TranscriptionResultMessage {
  readonly type: 'transcription-result'
  readonly requestId: string
  readonly transcribedText: string
}

export type TranscriptionErrorReason =
  | 'invalid-sample-rate'
  | 'model-load-failed'
  | 'transcription-failed'

export interface TranscriptionErrorMessage {
  readonly type: 'transcription-error'
  readonly requestId: string
  readonly reason: TranscriptionErrorReason
}

export interface GrammarCorrectionResultMessage {
  readonly type: 'grammar-correction-result'
  readonly requestId: string
  readonly correctedText: string
}

export type GrammarCorrectionErrorReason = 'model-load-failed' | 'correction-failed'

export interface GrammarCorrectionErrorMessage {
  readonly type: 'grammar-correction-error'
  readonly requestId: string
  readonly reason: GrammarCorrectionErrorReason
}

export type PreloadModelsErrorReason = 'model-load-failed'

export interface PreloadModelsResultMessage {
  readonly type: 'preload-models-result'
  readonly requestId: string
}

export interface PreloadModelsErrorMessage {
  readonly type: 'preload-models-error'
  readonly requestId: string
  readonly reason: PreloadModelsErrorReason
}

export type InferenceWorkerResponseMessage =
  | ModelLoadingProgressMessage
  | ModelReadyMessage
  | TranscriptionResultMessage
  | TranscriptionErrorMessage
  | GrammarCorrectionResultMessage
  | GrammarCorrectionErrorMessage
  | PreloadModelsResultMessage
  | PreloadModelsErrorMessage
