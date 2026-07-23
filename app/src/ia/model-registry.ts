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
  readonly revision: 'main'
}

export const modelRegistry = {
  automaticSpeechRecognition: {
    huggingFaceModelId: 'Xenova/whisper-tiny.en',
    task: 'automaticSpeechRecognition',
    revision: 'main',
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
