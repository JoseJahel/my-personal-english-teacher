/**
 * Adaptador del pipeline de corrección gramatical ('text2text-generation') de
 * `transformers.js` sobre el modelo T5 registrado en `model-registry.ts`
 * (`Xenova/t5-base-grammar-correction`, el port ONNX de
 * `vennify/t5-base-grammar-correction`). Segunda etapa del pipeline del
 * Avance 1 (ASR → gramática): recibe el texto ya transcrito por
 * `automatic-speech-recognition.ts` y devuelve su corrección. Pensado para
 * ejecutarse DENTRO del Web Worker orquestador (`inference-worker.ts`): no
 * importa nada de `ui/` (cero React), solo el pipeline de
 * `@huggingface/transformers`.
 *
 * Inferencia con WebGPU oportunista y WASM como caso base, mismo patrón que
 * `automatic-speech-recognition.ts` (ver "Convenciones y defaults técnicos"
 * en el README raíz): se intenta primero crear el pipeline con
 * `device: 'webgpu'`, y si esa creación falla (WebGPU no disponible en el
 * navegador, sin soporte de drivers, etc.) se reintenta automáticamente con
 * `device: 'wasm'`, el caso base sobre el que se mide el presupuesto de
 * latencia del proyecto.
 */

import { pipeline } from '@huggingface/transformers'
import type {
  PretrainedModelOptions,
  Text2TextGenerationOutput,
  Text2TextGenerationPipeline,
  Text2TextGenerationSingle,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'

/**
 * Tipo de la función de progreso que `transformers.js` invoca durante la
 * descarga de los pesos de un modelo. Mismo derivado por indexación que
 * `ModelDownloadProgressCallback` de `automatic-speech-recognition.ts` (ver
 * el porqué en ese archivo): `ProgressCallback` no es un tipo importable
 * directamente desde el punto de entrada público del paquete.
 */
export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

/**
 * Cantidad máxima de tokens nuevos a generar por corrección. 128 alcanza para
 * una frase de práctica típica del curso (post-utterance, ver "Convenciones y
 * defaults técnicos" en el README raíz) sin disparar la latencia de
 * inferencia en el navegador.
 */
const MAX_NEW_TOKENS_FOR_GRAMMAR_CORRECTION = 128

/**
 * Construye la entrada que espera `vennify/t5-base-grammar-correction` (y su
 * port ONNX `Xenova/t5-base-grammar-correction`): el modelo fue entrenado
 * para recibir el texto a corregir precedido del prefijo `'grammar: '`, sin
 * el cual no reconoce la tarea. Función pura para poder testearla sin cargar
 * el modelo real.
 *
 * @param rawEnglishText Texto en inglés a corregir, típicamente la
 *   transcripción cruda que devuelve `transcribeAudioSamples`.
 * @returns El texto recortado (`trim`) y prefijado con `'grammar: '`.
 */
export function buildGrammarCorrectionInput(rawEnglishText: string): string {
  return `grammar: ${rawEnglishText.trim()}`
}

/**
 * Crea (o descarga, si no está en caché del navegador) el pipeline de
 * corrección gramatical configurado en `model-registry.ts`. `onProgress`, si
 * se pasa, recibe cada evento de progreso de la descarga y se reenvía tal
 * cual al `progress_callback` de `transformers.js`; quien llama decide qué
 * hacer con cada evento (por ejemplo, `inference-worker.ts` los reenvía al
 * hilo principal mediante `postMessage`).
 *
 * @throws Si tanto la creación con WebGPU como el reintento con WASM fallan.
 */
export async function loadGrammarCorrector(
  onProgress?: ModelDownloadProgressCallback,
): Promise<Text2TextGenerationPipeline> {
  const { huggingFaceModelId, revision } = modelRegistry.grammarCorrection

  try {
    return await pipeline<'text2text-generation'>('text2text-generation', huggingFaceModelId, {
      revision,
      device: 'webgpu',
      progress_callback: onProgress,
    })
  } catch (webgpuError) {
    console.warn(
      'No fue posible crear el pipeline de corrección gramatical con WebGPU; se reintenta con WASM como caso base.',
      webgpuError,
    )
    return pipeline<'text2text-generation'>('text2text-generation', huggingFaceModelId, {
      revision,
      device: 'wasm',
      progress_callback: onProgress,
    })
  }
}

/**
 * Extrae el primer resultado de la salida del pipeline `text2text-generation`.
 * A diferencia de `AutomaticSpeechRecognitionOutput` (un objeto simple), el
 * tipo de `transformers.js` para esta tarea es `Text2TextGenerationOutput |
 * Text2TextGenerationOutput[]`, y ambas ramas de esa unión son arreglos
 * (`Text2TextGenerationOutput` ya es `Text2TextGenerationSingle[]`): un solo
 * `Array.isArray` no alcanza para distinguirlas. En la práctica, para una
 * entrada de un solo string el pipeline siempre devuelve
 * `Text2TextGenerationOutput` (un arreglo de un elemento), pero esta función
 * cubre también la forma anidada que permite el tipo, sin recurrir a un cast.
 */
function firstText2TextGenerationResult(
  output: Text2TextGenerationOutput | Text2TextGenerationOutput[],
): Text2TextGenerationSingle | undefined {
  const [firstElement] = output
  return Array.isArray(firstElement) ? firstElement[0] : firstElement
}

/**
 * Corrige la gramática de un texto en inglés usando un corrector ya cargado
 * con `loadGrammarCorrector`. Antepone el prefijo que exige el modelo con
 * `buildGrammarCorrectionInput` antes de invocar el pipeline.
 *
 * @returns El texto corregido, o una cadena vacía si el modelo no devolvió
 *   ningún resultado.
 */
export async function correctEnglishGrammar(
  corrector: Text2TextGenerationPipeline,
  englishText: string,
): Promise<string> {
  const output = await corrector(buildGrammarCorrectionInput(englishText), {
    max_new_tokens: MAX_NEW_TOKENS_FOR_GRAMMAR_CORRECTION,
  })
  const result = firstText2TextGenerationResult(output)
  return result?.generated_text ?? ''
}

/**
 * Normaliza un texto en inglés para compararlo ignorando diferencias de
 * formato que no son correcciones gramaticales reales: recorta espacios en
 * los extremos, colapsa espacios internos repetidos en uno solo, pasa todo a
 * minúsculas y quita un signo de puntuación final (`.`, `!` o `?`) si lo hay.
 * Función auxiliar de `grammarCorrectionMadeNoChanges`.
 */
function normalizeEnglishTextForComparison(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[.!?]+$/, '')
}

/**
 * Compara el texto transcrito original contra el texto que devolvió el
 * corrector gramatical, ignorando diferencias de formato irrelevantes
 * (espacios, mayúsculas/minúsculas y puntuación final), para decidir si la
 * corrección realmente cambió algo. `App.tsx` usa el resultado para mostrar
 * el mensaje de "sin correcciones necesarias" cuando el texto transcrito ya
 * era gramaticalmente correcto. Función pura, testeable sin cargar el modelo.
 */
export function grammarCorrectionMadeNoChanges(
  transcribedText: string,
  correctedText: string,
): boolean {
  return (
    normalizeEnglishTextForComparison(transcribedText) ===
    normalizeEnglishTextForComparison(correctedText)
  )
}
