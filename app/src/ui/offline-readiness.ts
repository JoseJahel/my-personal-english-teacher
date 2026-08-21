/**
 * Tells the learner whether this browser can already practise offline.
 *
 * The answer is derived from `ModelLoadHistory`, not from the transformers.js
 * cache: on @huggingface/transformers 3.8.1 a cached read emits the same byte
 * progress events as a network download, so the load itself carries no origin
 * signal (verified with instrumented runs).
 */

import type { ModelRegistryKey } from '../ia/model-registry'
import type { ModelLoadHistorySnapshot } from '../storage/model-load-history'
import { homeScreenInterfaceTexts } from './interface-texts'

/**
 * Models whose load the UI can observe.
 *
 * `textToSpeechVocoder` is deliberately absent: Supertonic decodes audio
 * itself, and the worker never emits `model-ready` for the unused vocoder
 * key, so including it would block `fully-cached`.
 *
 * `textToSpeech` here covers only the Supertonic ONNX weights. The pinned
 * F1 voice reference audio is a separate file, fetched by
 * `preloadTutorVoiceEmbeddings` (see `../ia/text-to-speech-synthesis.ts`)
 * during warm preload; that fetch does not emit a `model-ready` origin
 * signal, so its cache state is not part of this computation.
 */
export const OFFLINE_READINESS_MODEL_KEYS = [
  'automaticSpeechRecognition',
  'grammarCorrection',
  'textToSpeech',
  'conversationSuggestions',
] as const satisfies readonly ModelRegistryKey[]

/**
 * Three states rather than two, because the models load at different moments:
 * ASR, grammar and Supertonic preload on mount; SmolLM2 on scenario selection.
 * A learner who has not picked a scenario yet sits in between, and saying
 * "ready offline" there would be a lie.
 */
export type OfflineReadiness = 'none-cached' | 'partially-cached' | 'fully-cached'

export function resolveOfflineReadiness(snapshot: ModelLoadHistorySnapshot): OfflineReadiness {
  const cachedCount = OFFLINE_READINESS_MODEL_KEYS.filter(
    (modelKey) => snapshot.originFor(modelKey) === 'cache',
  ).length

  if (cachedCount === 0) {
    return 'none-cached'
  }
  if (cachedCount === OFFLINE_READINESS_MODEL_KEYS.length) {
    return 'fully-cached'
  }
  return 'partially-cached'
}

export function offlineReadinessMessageFor(readiness: OfflineReadiness): string {
  switch (readiness) {
    case 'none-cached':
      return homeScreenInterfaceTexts.offlineReadiness.noneCached
    case 'partially-cached':
      return homeScreenInterfaceTexts.offlineReadiness.partiallyCached
    case 'fully-cached':
      return homeScreenInterfaceTexts.offlineReadiness.fullyCached
  }
}

/** Short rail footer line (Atelier shell). */
export function offlineReadinessCompactMessageFor(readiness: OfflineReadiness): string {
  switch (readiness) {
    case 'none-cached':
      return homeScreenInterfaceTexts.offlineReadinessCompact.noneCached
    case 'partially-cached':
      return homeScreenInterfaceTexts.offlineReadinessCompact.partiallyCached
    case 'fully-cached':
      return homeScreenInterfaceTexts.offlineReadinessCompact.fullyCached
  }
}
