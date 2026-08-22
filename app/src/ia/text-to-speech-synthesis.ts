/**
 * Supertonic TTS adapter for transformers.js (runs inside the inference worker).
 * Uses registry model onnx-community/Supertonic-TTS-ONNX; no separate vocoder.
 *
 * Voice embeddings caching (verified against @huggingface/transformers 3.8.1):
 * the pipeline accepts `speaker_embeddings` as a `Tensor | Float32Array | string
 * | URL` (see `types/pipelines.d.ts`). When given a string/URL, its own loader
 * — `_prepare_speaker_embeddings` in `src/pipelines.js` — resolves it with a
 * raw `fetch()`:
 *
 *   if (typeof speaker_embeddings === 'string' || speaker_embeddings instanceof URL) {
 *     speaker_embeddings = new Float32Array(await (await fetch(speaker_embeddings)).arrayBuffer())
 *   }
 *
 * That `fetch()` never goes through `getModelFile`/`utils/hub.js` — the only
 * path that opens `caches.open('transformers-cache')` when
 * `env.useBrowserCache` is true (`src/utils/hub.js`, `getModelFile`). So a
 * plain URL string here would (a) never land in the persistent model-weight
 * cache, (b) emit no download progress, and (c) be invisible to
 * `offline-readiness.ts`. `getModelFile` itself is an internal, unexported
 * helper (not part of the package's public `exports` map), so it cannot be
 * called directly without depending on library internals.
 *
 * Fix applied here: `preloadTutorVoiceEmbeddings` downloads the pinned voice
 * file once (during warm preload, see `warm-model-preload.ts`) using the
 * standard Cache Storage API — reusing the same `transformers-cache` bucket
 * name transformers.js uses for weights, so the file persists offline
 * alongside the rest of the pinned models — and keeps the decoded
 * `Float32Array` in memory. `synthesizeSpeechFromText` then hands the
 * pipeline that `Float32Array` directly instead of a URL, so its raw `fetch`
 * path is never exercised in the normal case.
 */

import { pipeline } from '@huggingface/transformers'
import type {
  PretrainedModelOptions,
  TextToAudioOutput,
  TextToAudioPipeline,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'
import type { OnnxInferenceDevice } from './resolve-inference-device'
import { normalizeEnglishTextForSpeech } from './speech-text-normalization'

/** Cache Storage bucket name @huggingface/transformers opens for model weights (`utils/hub.js`). */
const TRANSFORMERS_CACHE_STORAGE_NAME = 'transformers-cache'

export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

/** Official English female tutor voice shipped with the ONNX package. */
export const DEFAULT_TUTOR_VOICE_ID = 'F1'

/** Official default: more steps = clearer, slower. 5 is the documented quality/speed bar. */
export const DEFAULT_SUPERTONIC_INFERENCE_STEPS = 5

/** Neutral tutoring pace (the HF demo uses 1.05; 1.0 is easier to follow). */
export const DEFAULT_SUPERTONIC_SPEED = 1

/** Supertonic ONNX files are fp32; do not request q8 (those weights are not published). */
export const SUPERTONIC_ONNX_DTYPE = 'fp32' as const

/** Hard cap so a paste/bug cannot request an unbounded synthesis. */
export const MAXIMUM_TTS_INPUT_CHARACTERS = 400

export interface SynthesizedSpeechAudio {
  readonly samples: Float32Array
  readonly sampleRateInHertz: number
}

export function tutorVoiceEmbeddingsUrl(voiceId: string = DEFAULT_TUTOR_VOICE_ID): string {
  const { huggingFaceModelId, revision } = modelRegistry.textToSpeech
  return `https://huggingface.co/${huggingFaceModelId}/resolve/${revision}/voices/${voiceId}.bin`
}

/** Thrown by `preloadTutorVoiceEmbeddings` when the voice file cannot be fetched. */
export class TutorVoiceEmbeddingsPreloadError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options)
    this.name = 'TutorVoiceEmbeddingsPreloadError'
  }
}

/** In-memory copy of already-downloaded voice embeddings, keyed by voice id. */
const preloadedVoiceEmbeddingsByVoiceId = new Map<string, Float32Array>()

/**
 * Downloads (or reuses) the pinned tutor voice reference audio and keeps the
 * decoded samples in memory so `synthesizeSpeechFromText` can hand them to
 * the pipeline directly instead of a URL (see module doc comment for why).
 * Also persists the raw bytes to the `transformers-cache` Cache Storage
 * bucket so a later worker/session does not have to redownload the file to
 * repopulate this in-memory cache.
 *
 * Never throws silently: on failure it wraps the cause in a
 * `TutorVoiceEmbeddingsPreloadError` and rejects — callers (warm preload)
 * are expected to log it and continue, since `synthesizeSpeechFromText`
 * still falls back to fetching the URL itself on first use.
 */
export async function preloadTutorVoiceEmbeddings(
  voiceId: string = DEFAULT_TUTOR_VOICE_ID,
): Promise<Float32Array> {
  const cached = preloadedVoiceEmbeddingsByVoiceId.get(voiceId)
  if (cached) {
    return cached
  }

  const url = tutorVoiceEmbeddingsUrl(voiceId)
  try {
    const buffer = await fetchAndCacheVoiceEmbeddingsBuffer(url)
    const samples = new Float32Array(buffer)
    preloadedVoiceEmbeddingsByVoiceId.set(voiceId, samples)
    return samples
  } catch (error) {
    throw new TutorVoiceEmbeddingsPreloadError(
      `Failed to preload tutor voice embeddings from "${url}".`,
      { cause: error },
    )
  }
}

/** Test-only: clears the in-memory voice preload cache so specs stay isolated. */
export function resetPreloadedTutorVoiceEmbeddingsForTests(): void {
  preloadedVoiceEmbeddingsByVoiceId.clear()
}

async function fetchAndCacheVoiceEmbeddingsBuffer(url: string): Promise<ArrayBuffer> {
  const cache = await openTransformersCacheStorage()
  if (cache) {
    const cached = await cache.match(url)
    if (cached) {
      return cached.arrayBuffer()
    }
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Voice embeddings request failed with HTTP status ${response.status}.`)
  }

  if (cache) {
    // Cache Storage entries can only be read once, so persist a clone and
    // read the body from the original response below.
    try {
      await cache.put(url, response.clone())
    } catch (error) {
      console.warn('Tutor voice embeddings: failed to persist to browser cache.', error)
    }
  }

  return response.arrayBuffer()
}

async function openTransformersCacheStorage(): Promise<Cache | undefined> {
  if (typeof caches === 'undefined') {
    return undefined
  }
  try {
    return await caches.open(TRANSFORMERS_CACHE_STORAGE_NAME)
  } catch (error) {
    console.warn(
      'Tutor voice embeddings: browser cache unavailable, fetching without persisting.',
      error,
    )
    return undefined
  }
}

/** Loads (or reuses cached) Supertonic text-to-speech pipeline (`text-to-speech` → text-to-audio). */
export async function loadTextToSpeechSynthesizer(
  device: OnnxInferenceDevice,
  onProgress?: ModelDownloadProgressCallback,
): Promise<TextToAudioPipeline> {
  const { huggingFaceModelId, revision } = modelRegistry.textToSpeech

  const synthesizer = await pipeline('text-to-speech', huggingFaceModelId, {
    revision,
    device,
    dtype: SUPERTONIC_ONNX_DTYPE,
    progress_callback: onProgress,
  })
  return synthesizer as unknown as TextToAudioPipeline
}

/**
 * Normalize and bound English text before synthesis. Expands numbers, prices,
 * codes and simple times (see `normalizeEnglishTextForSpeech`, #77) so the
 * tutor voice pronounces them reliably — this only affects the audio input, not
 * the text shown in the chat.
 * Returns empty string when there is nothing speakable.
 */
export function prepareTextForSpeechSynthesis(rawText: string): string {
  const collapsed = rawText.replace(/\s+/g, ' ').trim()
  if (!collapsed) {
    return ''
  }
  const normalized = normalizeEnglishTextForSpeech(collapsed)
  if (normalized.length <= MAXIMUM_TTS_INPUT_CHARACTERS) {
    return normalized
  }
  return normalized.slice(0, MAXIMUM_TTS_INPUT_CHARACTERS).trim()
}

/**
 * Synthesize mono PCM for English text with a loaded Supertonic pipeline.
 * Voice embeddings default to the pinned F1 tutor voice.
 */
export async function synthesizeSpeechFromText(
  synthesizer: TextToAudioPipeline,
  englishText: string,
  options?: {
    readonly voiceId?: string
    readonly speakerEmbeddingsUrl?: string
    readonly numInferenceSteps?: number
    readonly speed?: number
  },
): Promise<SynthesizedSpeechAudio> {
  const text = prepareTextForSpeechSynthesis(englishText)
  if (!text) {
    return {
      samples: new Float32Array(0),
      sampleRateInHertz: 16_000,
    }
  }

  const voiceId = options?.voiceId ?? DEFAULT_TUTOR_VOICE_ID
  // Prefer bytes `preloadTutorVoiceEmbeddings` already downloaded during warm
  // preload; only fall back to the URL (which the pipeline fetches itself,
  // uncached — see module doc comment) when nothing was preloaded, e.g. the
  // preload failed or has not run yet.
  const speakerEmbeddings: Float32Array | string =
    options?.speakerEmbeddingsUrl ??
    preloadedVoiceEmbeddingsByVoiceId.get(voiceId) ??
    tutorVoiceEmbeddingsUrl(voiceId)

  const output = await synthesizer(text, {
    speaker_embeddings: speakerEmbeddings,
    num_inference_steps: options?.numInferenceSteps ?? DEFAULT_SUPERTONIC_INFERENCE_STEPS,
    speed: options?.speed ?? DEFAULT_SUPERTONIC_SPEED,
  })

  return normalizeTextToSpeechPipelineOutput(output)
}

/** Extract a contiguous Float32Array + sample rate from transformers.js TTS output. */
export function normalizeTextToSpeechPipelineOutput(
  output: TextToAudioOutput | TextToAudioOutput[] | null | undefined,
): SynthesizedSpeechAudio {
  const result = Array.isArray(output) ? output[0] : output
  if (!result) {
    return { samples: new Float32Array(0), sampleRateInHertz: 16_000 }
  }

  const sampleRateInHertz =
    typeof result.sampling_rate === 'number' && result.sampling_rate > 0
      ? result.sampling_rate
      : 16_000

  const samples = copyToFloat32Array(result.audio)
  return { samples, sampleRateInHertz }
}

function copyToFloat32Array(audio: unknown): Float32Array {
  if (audio instanceof Float32Array) {
    const copy = new Float32Array(audio.length)
    copy.set(audio)
    return copy
  }
  if (Array.isArray(audio)) {
    return Float32Array.from(audio.map((value) => Number(value)))
  }
  if (audio && typeof audio === 'object' && 'length' in audio) {
    const view = audio as { length: number; [index: number]: unknown }
    const copy = new Float32Array(view.length)
    for (let index = 0; index < view.length; index += 1) {
      copy[index] = Number(view[index] ?? 0)
    }
    return copy
  }
  return new Float32Array(0)
}
