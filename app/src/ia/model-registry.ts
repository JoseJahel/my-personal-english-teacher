/**
 * Single source of truth for Hugging Face model IDs used by transformers.js.
 * Keep `revision: 'main'` only during development; pin SHAs before final delivery.
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
  /** Hub revision; replace `'main'` with a commit SHA before final release. */
  readonly revision: string
}

/**
 * ASR candidates evaluados por el banco de pruebas dev (Sección 1 del diseño).
 * `approxDownloadMb` es una estimación aproximada para el copy de primera
 * descarga; se refina con los números reales tras correr el benchmark.
 * TODO: fijar `revision` a un SHA de commit por candidato antes de entrega final.
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
    revision: 'main',
    approxDownloadMb: 40,
  },
  'base-en': {
    modelId: 'Xenova/whisper-base.en',
    revision: 'main',
    approxDownloadMb: 75,
  },
  'distil-small-en': {
    modelId: 'onnx-community/distil-small.en',
    revision: 'main',
    approxDownloadMb: 170,
  },
  'small-en': {
    modelId: 'Xenova/whisper-small.en',
    revision: 'main',
    approxDownloadMb: 250,
  },
}

/** Default de producción en esta ronda: cero regresión hasta ver las tablas del benchmark. */
export const DEFAULT_ASR_CANDIDATE_ID: AsrModelCandidateId = 'tiny-en'

function readAsrModelOverride(): AsrModelCandidateId | null {
  try {
    // Vite injects import.meta.env in the worker bundle as well. Read the
    // property directly (no cast) so Vite/Vitest keep this dynamic in dev/test
    // (Vitest, `vite dev`) instead of freezing it to a transform-time snapshot
    // — see model-registry.test.ts. Production builds always inline VITE_*
    // vars at build time; this only helps at dev/test time.
    const override = import.meta.env.VITE_ASR_MODEL
    if (override && override in asrModelCandidates) {
      return override as AsrModelCandidateId
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Candidato ASR activo: override `VITE_ASR_MODEL` cuando es válido, si no el
 * default. Análogo a `resolvePreferredOnnxDevice` en resolve-inference-device.ts.
 */
export function resolveActiveAsrCandidateId(): AsrModelCandidateId {
  return readAsrModelOverride() ?? DEFAULT_ASR_CANDIDATE_ID
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
    revision: 'main',
  },
  textToSpeech: {
    huggingFaceModelId: 'Xenova/speecht5_tts',
    task: 'textToSpeech',
    revision: 'main',
  },
  textToSpeechVocoder: {
    huggingFaceModelId: 'Xenova/speecht5_hifigan',
    task: 'textToSpeechVocoder',
    revision: 'main',
  },
  conversationSuggestions: {
    huggingFaceModelId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    task: 'conversationSuggestions',
    revision: 'main',
  },
} as const satisfies Record<string, RegisteredModelDescriptor>

export type ModelRegistryKey = keyof typeof modelRegistry
