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
 * `textToSpeechVocoder` is deliberately absent: the inference worker never
 * emits `model-ready` for it (it loads inside the SpeechT5 pipeline), so it
 * would never be marked and readiness could never reach `fully-cached`.
 */
export const OFFLINE_READINESS_MODEL_KEYS = [
  'automaticSpeechRecognition',
  'grammarCorrection',
  'textToSpeech',
  'conversationSuggestions',
] as const satisfies readonly ModelRegistryKey[]

/**
 * Three states rather than two, because the models load at different moments:
 * ASR and grammar preload on mount, SmolLM2 on scenario selection, and TTS on
 * the first tutor reply. A learner who has only spoken once genuinely sits in
 * between, and saying "ready offline" there would be a lie.
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
