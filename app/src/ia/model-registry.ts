/**
 * Single source of truth for Hugging Face model IDs used by transformers.js.
 * Revisions are pinned to Hub commit SHAs for reproducible final delivery.
 * SHAs fetched from huggingface.co/api/models on 2026-08-03 (main tip then).
 */

export type SupportedInferenceTask =
  | 'automaticSpeechRecognition'
  | 'grammarCorrection'
  | 'textToSpeech'
  | 'textToSpeechVocoder'
  | 'conversationSuggestions'

export interface RegisteredModelDescriptor {
  readonly huggingFaceModelId: string
  readonly task: SupportedInferenceTask
  /** Hub commit SHA (pinned; do not use floating `'main'` in release builds). */
  readonly revision: string
}

/**
 * ASR candidates evaluated by the dev benchmark screen.
 * `approxDownloadMb` is a rough first-download estimate for UI copy.
 */
export type AsrModelCandidateId = 'tiny-en' | 'base-en' | 'distil-small-en' | 'small-en'

export interface AsrModelCandidateDescriptor {
  readonly modelId: string
  readonly revision: string
  readonly approxDownloadMb: number
}

export const asrModelCandidates: Record<AsrModelCandidateId, AsrModelCandidateDescriptor> = {
  'tiny-en': {
    modelId: 'Xenova/whisper-tiny.en',
    revision: '79fb389fc764e7c395bd330e9531d9d32ada7049',
    approxDownloadMb: 40,
  },
  'base-en': {
    modelId: 'Xenova/whisper-base.en',
    revision: '95bf40a508535962c6483ead40270b2e32267508',
    approxDownloadMb: 75,
  },
  'distil-small-en': {
    modelId: 'onnx-community/distil-small.en',
    revision: '69be759f982d1d4c5b8a987d4140752742619bd0',
    approxDownloadMb: 170,
  },
  'small-en': {
    modelId: 'Xenova/whisper-small.en',
    revision: 'fa16a75f5d91e83ecb6a2ccb690f14d91ef00ca4',
    approxDownloadMb: 250,
  },
}

/**
 * Production default: chosen by the 2026-07-29 benchmark on the reference
 * machine. small-en had the best WER (0.000 on all fixtures) and ~3.4 s per
 * utterance on WebGPU (viable); on WASM it is ~11 s (not viable). Default
 * device policy auto-detects WebGPU for ASR (see resolve-inference-device.ts).
 * tiny-en/base-en remain available via `VITE_ASR_MODEL` and the dev bench.
 */
export const DEFAULT_ASR_CANDIDATE_ID: AsrModelCandidateId = 'small-en'

/** Named demo profiles (issue #61). Precision stays the production default. */
export type AsrDemoProfileId = 'precision' | 'latency'

/** Latency demo profile uses tiny-en; do not claim <2 s until re-measured. */
export const LATENCY_ASR_DEMO_PROFILE_CANDIDATE_ID: AsrModelCandidateId = 'tiny-en'

export const ASR_DEMO_PROFILE_CANDIDATES: Record<AsrDemoProfileId, AsrModelCandidateId> = {
  precision: DEFAULT_ASR_CANDIDATE_ID,
  latency: LATENCY_ASR_DEMO_PROFILE_CANDIDATE_ID,
}

function readViteEnvString(name: 'VITE_ASR_MODEL' | 'VITE_ASR_PROFILE'): string | undefined {
  try {
    // Read each key as a property (no cast) so Vite/Vitest keep this dynamic.
    if (name === 'VITE_ASR_PROFILE') {
      return import.meta.env.VITE_ASR_PROFILE
    }
    return import.meta.env.VITE_ASR_MODEL
  } catch {
    return undefined
  }
}

function readAsrDemoProfileOverride(): AsrDemoProfileId | null {
  const override = readViteEnvString('VITE_ASR_PROFILE')
  if (override === 'latency' || override === 'precision') {
    return override
  }
  return null
}

export function resolveAsrDemoProfile(): AsrDemoProfileId {
  return readAsrDemoProfileOverride() ?? 'precision'
}

function readAsrModelOverride(): AsrModelCandidateId | null {
  try {
    // Vite injects import.meta.env in the worker bundle as well. Read the
    // property directly (no cast) so Vite/Vitest keep this dynamic in dev/test
    // (Vitest, `vite dev`) instead of freezing it to a transform-time snapshot
    // — see model-registry.test.ts. Production builds always inline VITE_*
    // vars at build time; this only helps at dev/test time.
    const override = readViteEnvString('VITE_ASR_MODEL')
    if (override && override in asrModelCandidates) {
      return override as AsrModelCandidateId
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Active ASR candidate: `VITE_ASR_MODEL` wins, else `VITE_ASR_PROFILE`,
 * else the precision default (`small-en`).
 */
export function resolveActiveAsrCandidateId(): AsrModelCandidateId {
  return (
    readAsrModelOverride() ?? ASR_DEMO_PROFILE_CANDIDATES[resolveAsrDemoProfile()]
  )
}

const defaultAsrCandidate = asrModelCandidates[DEFAULT_ASR_CANDIDATE_ID]

export const modelRegistry = {
  automaticSpeechRecognition: {
    huggingFaceModelId: defaultAsrCandidate.modelId,
    task: 'automaticSpeechRecognition',
    revision: defaultAsrCandidate.revision,
  },
  grammarCorrection: {
    huggingFaceModelId: 'Xenova/t5-base-grammar-correction',
    task: 'grammarCorrection',
    revision: 'c439d702d7b7b178b96b64d4dc4537308963c271',
  },
  textToSpeech: {
    huggingFaceModelId: 'Xenova/speecht5_tts',
    task: 'textToSpeech',
    revision: '1723781b8ce2d02f0400c8337be04ae8ee3d6d56',
  },
  textToSpeechVocoder: {
    huggingFaceModelId: 'Xenova/speecht5_hifigan',
    task: 'textToSpeechVocoder',
    revision: 'cf980c3610d7b7f20919960031066ef7905737bd',
  },
  conversationSuggestions: {
    huggingFaceModelId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    task: 'conversationSuggestions',
    revision: 'a10cc1512eabd3dde888204e902eca88bddb4951',
  },
} as const satisfies Record<string, RegisteredModelDescriptor>

export type ModelRegistryKey = keyof typeof modelRegistry
