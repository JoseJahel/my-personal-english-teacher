/**
 * Adaptador del pipeline de reconocimiento de voz (ASR) de `transformers.js`
 * sobre el modelo Whisper registrado en `model-registry.ts`
 * (`Xenova/whisper-tiny.en`). Pensado para ejecutarse DENTRO del Web Worker
 * orquestador (`inference-worker.ts`): no importa nada de `ui/` (cero React),
 * solo el pipeline de `@huggingface/transformers`.
 *
 * Inferencia con WebGPU oportunista y WASM como caso base (convención del
 * proyecto, ver "Convenciones y defaults técnicos" en el README raíz): se
 * intenta primero crear el pipeline con `device: 'webgpu'`, y si esa creación
 * falla (WebGPU no disponible en el navegador, sin soporte de drivers, etc.)
 * se reintenta automáticamente con `device: 'wasm'`, el caso base sobre el
 * que se mide el presupuesto de latencia del proyecto.
 */

import { pipeline } from '@huggingface/transformers'
import type {
  AutomaticSpeechRecognitionPipeline,
  PretrainedModelOptions,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'

/**
 * Tipo de la función de progreso que `transformers.js` invoca durante la
 * descarga de los pesos de un modelo (una vez por cada archivo y por cada
 * avance de descarga). Se deriva por indexación desde `PretrainedModelOptions`
 * -el único tipo relacionado que el paquete expone en su punto de entrada
 * público- en vez de importar `ProgressCallback` directamente: ese tipo vive
 * en un módulo interno (`utils/core.js`) que el `package.json` de
 * `@huggingface/transformers` no expone como subpath importable (solo expone
 * el punto de entrada raíz del paquete).
 */
export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

/**
 * Evento individual que recibe `ModelDownloadProgressCallback`. Es una unión
 * discriminada por `status` (`'initiate' | 'download' | 'progress' | 'done' |
 * 'ready'`); solo la variante `'progress'` trae el porcentaje de avance.
 */
export type ModelDownloadProgressEvent = Parameters<ModelDownloadProgressCallback>[0]

/**
 * Crea (o descarga, si no está en caché del navegador) el pipeline de
 * reconocimiento de voz configurado en `model-registry.ts`. `onProgress`, si
 * se pasa, recibe cada evento de progreso de la descarga y se reenvía tal
 * cual al `progress_callback` de `transformers.js`; quien llama decide qué
 * hacer con cada evento (por ejemplo, `inference-worker.ts` los reenvía al
 * hilo principal mediante `postMessage`).
 *
 * @throws Si tanto la creación con WebGPU como el reintento con WASM fallan.
 */
export async function loadSpeechRecognizer(
  onProgress?: ModelDownloadProgressCallback,
): Promise<AutomaticSpeechRecognitionPipeline> {
  const { huggingFaceModelId, revision } = modelRegistry.automaticSpeechRecognition

  try {
    return await pipeline<'automatic-speech-recognition'>(
      'automatic-speech-recognition',
      huggingFaceModelId,
      { revision, device: 'webgpu', progress_callback: onProgress },
    )
  } catch (webgpuError) {
    console.warn(
      'No fue posible crear el pipeline de ASR con WebGPU; se reintenta con WASM como caso base.',
      webgpuError,
    )
    return pipeline<'automatic-speech-recognition'>(
      'automatic-speech-recognition',
      huggingFaceModelId,
      { revision, device: 'wasm', progress_callback: onProgress },
    )
  }
}

/**
 * Transcribe un segmento de audio mono a 16 kHz (la tasa que exige Whisper,
 * ver `WHISPER_SAMPLE_RATE_IN_HERTZ` en `audio/audio-resampler.ts`) usando un
 * reconocedor ya cargado con `loadSpeechRecognizer`. Whisper extrae sus
 * propias features acústicas internamente: el pipeline acepta el
 * `Float32Array` de muestras directamente, sin pasar por el extractor de
 * MFCC propio de `dsp/` (que solo alimenta al futuro comparador de
 * pronunciación, ver la convención correspondiente en el README raíz).
 *
 * @returns El texto transcrito, o una cadena vacía si el modelo no devolvió
 *   ningún resultado.
 */
export async function transcribeAudioSamples(
  recognizer: AutomaticSpeechRecognitionPipeline,
  samples16kHz: Float32Array,
): Promise<string> {
  // El Float32Array ya viene a 16 kHz (ver `resampleToWhisperRate`).
  // NO se pasan `language` ni `task`: `whisper-tiny.en` es solo-inglés y
  // transformers.js lanza si se intentan fijar. `chunk_length_s` parte
  // grabaciones largas en tramos que Whisper maneja bien (~30 s).
  const output = await recognizer(samples16kHz, {
    chunk_length_s: 30,
    stride_length_s: 5,
  })
  const result = Array.isArray(output) ? output[0] : output
  // Whisper a veces devuelve el texto con un espacio inicial; se recorta para
  // que la UI y la etapa de gramática no trabajen con padding artificial.
  return (result?.text ?? '').trim()
}
