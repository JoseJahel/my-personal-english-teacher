/**
 * Typed main-thread ↔ inference-worker message protocol (structured clone).
 * Single shared shapes file so both ends stay in sync at compile time.
 */

import type { AsrModelCandidateId, ModelRegistryKey } from './model-registry'
import type { OnnxInferenceDevice } from './resolve-inference-device'

export interface TranscribeRequestMessage {
  readonly type: 'transcribe'
  readonly requestId: string
  readonly audioSamples: Float32Array
  /** Explicit so the worker can reject non-16 kHz audio with a typed reason. */
  readonly sampleRate: number
  /** Benchmark-only override; normal app flow omits it (uses the active candidate). */
  readonly asrCandidateId?: AsrModelCandidateId
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
  /** Benchmark-only override; normal app flow omits it (uses the active candidate). */
  readonly asrCandidateId?: AsrModelCandidateId
}

/** Synthesize speech for English text (SpeechT5). Loaded on first use — not in default preload. */
export interface SynthesizeSpeechRequestMessage {
  readonly type: 'synthesize-speech'
  readonly requestId: string
  readonly inputText: string
}

/** One prior turn of the practice conversation; batches are oldest-first. */
export interface TutorReplyHistoryTurn {
  readonly speaker: 'tutor' | 'student'
  readonly textEn: string
}

/** SmolLM2 tutor reply (hybrid scenario + generation). Loaded on first use. */
export interface GenerateTutorReplyRequestMessage {
  readonly type: 'generate-tutor-reply'
  readonly requestId: string
  readonly scenarioContextEn: string
  /** Last up-to-4 turns (2 pairs), oldest first — short-term conversation memory. */
  readonly historyTurnsEn: readonly TutorReplyHistoryTurn[]
  readonly userUtteranceEn: string
  readonly fallbackReplyEn: string
}

/**
 * Dev benchmark only: force the ONNX device for this worker instance,
 * bypassing `resolvePreferredOnnxDevice()`. Fire-and-forget (no requestId,
 * no response) — the worker applies it synchronously before any later
 * message is processed, since postMessage delivery is ordered on a single
 * worker thread.
 */
export interface SetPreferredDeviceMessage {
  readonly type: 'set-preferred-device'
  readonly device: OnnxInferenceDevice
}

export type InferenceWorkerRequestMessage =
  | TranscribeRequestMessage
  | CorrectGrammarRequestMessage
  | PreloadModelsRequestMessage
  | SynthesizeSpeechRequestMessage
  | GenerateTutorReplyRequestMessage
  | PreloadConversationModelRequestMessage
  | SetPreferredDeviceMessage

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

/** Warm-load SmolLM2 only, triggered when the learner picks a scenario (not at boot). */
export interface PreloadConversationModelRequestMessage {
  readonly type: 'preload-conversation-model'
  readonly requestId: string
}

export type PreloadConversationModelErrorReason = 'model-load-failed'

export interface PreloadConversationModelResultMessage {
  readonly type: 'preload-conversation-model-result'
  readonly requestId: string
}

export interface PreloadConversationModelErrorMessage {
  readonly type: 'preload-conversation-model-error'
  readonly requestId: string
  readonly reason: PreloadConversationModelErrorReason
}

export interface SynthesizeSpeechResultMessage {
  readonly type: 'synthesize-speech-result'
  readonly requestId: string
  readonly audioSamples: Float32Array
  readonly sampleRateInHertz: number
}

export type SynthesizeSpeechErrorReason = 'model-load-failed' | 'synthesis-failed' | 'empty-text'

export interface SynthesizeSpeechErrorMessage {
  readonly type: 'synthesize-speech-error'
  readonly requestId: string
  readonly reason: SynthesizeSpeechErrorReason
}

export interface GenerateTutorReplyResultMessage {
  readonly type: 'generate-tutor-reply-result'
  readonly requestId: string
  readonly tutorReplyText: string
  /** True when SmolLM2 failed/empty and the scenario fallback line was used. */
  readonly usedFallback: boolean
}

export type GenerateTutorReplyErrorReason = 'model-load-failed' | 'generation-failed'

export interface GenerateTutorReplyErrorMessage {
  readonly type: 'generate-tutor-reply-error'
  readonly requestId: string
  readonly reason: GenerateTutorReplyErrorReason
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
  | SynthesizeSpeechResultMessage
  | SynthesizeSpeechErrorMessage
  | GenerateTutorReplyResultMessage
  | GenerateTutorReplyErrorMessage
  | PreloadConversationModelResultMessage
  | PreloadConversationModelErrorMessage
