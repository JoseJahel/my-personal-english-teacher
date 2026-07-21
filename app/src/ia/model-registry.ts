/**
 * Catálogo tipado de los modelos de inteligencia artificial usados por la
 * aplicación. Es la única fuente de verdad para los identificadores del
 * Hub de Hugging Face que consumirá `transformers.js`: nada en `ia/` ni en
 * capas superiores debería escribir un ID de modelo "a mano" fuera de aquí.
 *
 * `revision` está fijado a 'main' durante el scaffolding para poder iterar
 * rápido con el equipo. Antes de la Entrega Final se debe anclar cada modelo
 * a un commit SHA específico del Hub (en vez de 'main') para garantizar que
 * la build sea reproducible y no cambie si el autor del modelo sube una
 * actualización sin previo aviso.
 */

export type SupportedInferenceTask =
  | 'automaticSpeechRecognition'
  | 'grammarCorrection'
  | 'textToSpeech'
  | 'textToSpeechVocoder'
  | 'conversationSuggestions'

export interface RegisteredModelDescriptor {
  /** Identificador exacto del modelo en el Hub de Hugging Face. */
  readonly huggingFaceModelId: string
  /** Tarea de inferencia para la que se usa este modelo dentro del pipeline. */
  readonly task: SupportedInferenceTask
  /**
   * Revisión del modelo a descargar. 'main' durante el desarrollo del
   * scaffolding; se debe reemplazar por un commit SHA fijo antes de la
   * Entrega Final.
   */
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
