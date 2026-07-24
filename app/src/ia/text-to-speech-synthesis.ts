/**
 * SpeechT5 TTS adapter for transformers.js (runs inside the inference worker).
 * Uses registry model Xenova/speecht5_tts; HiFi-GAN vocoder is the pipeline default.
 */

import { pipeline } from '@huggingface/transformers'
import type {
  PretrainedModelOptions,
  TextToAudioOutput,
  TextToAudioPipeline,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'
import type { OnnxInferenceDevice } from './resolve-inference-device'

export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

/**
 * Official Xenova demo speaker embedding (x-vector).
 * Loaded by transformers.js when passed as URL to the pipeline call.
 */
export const DEFAULT_SPEECHT5_SPEAKER_EMBEDDINGS_URL =
  'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin'

/** Hard cap so a paste/bug cannot request an unbounded synthesis. */
export const MAXIMUM_TTS_INPUT_CHARACTERS = 400

/** SpeechT5 is quality-sensitive; prefer fp32 even on WASM (matches Xenova docs). */
export const SPEECHT5_ONNX_DTYPE = 'fp32' as const

export interface SynthesizedSpeechAudio {
  readonly samples: Float32Array
  readonly sampleRateInHertz: number
}

/** Loads (or reuses cached) SpeechT5 text-to-speech pipeline (`text-to-speech` → text-to-audio). */
export async function loadTextToSpeechSynthesizer(
  device: OnnxInferenceDevice,
  onProgress?: ModelDownloadProgressCallback,
): Promise<TextToAudioPipeline> {
  const { huggingFaceModelId, revision } = modelRegistry.textToSpeech

  // Alias `text-to-speech` resolves to text-to-audio; default vocoder is HiFi-GAN.
  // Cast via unknown: the pipeline() overload union is too wide for TS to instantiate.
  const synthesizer = await pipeline('text-to-speech', huggingFaceModelId, {
    revision,
    device,
    dtype: SPEECHT5_ONNX_DTYPE,
    progress_callback: onProgress,
  })
  return synthesizer as unknown as TextToAudioPipeline
}

/**
 * Normalize and bound English text before synthesis.
 * Returns empty string when there is nothing speakable.
 */
export function prepareTextForSpeechSynthesis(rawText: string): string {
  const collapsed = rawText.replace(/\s+/g, ' ').trim()
  if (!collapsed) {
    return ''
  }
  if (collapsed.length <= MAXIMUM_TTS_INPUT_CHARACTERS) {
    return collapsed
  }
  return collapsed.slice(0, MAXIMUM_TTS_INPUT_CHARACTERS).trim()
}

/**
 * Synthesize mono PCM for English text with a loaded SpeechT5 pipeline.
 * Speaker embeddings default to the Xenova demo x-vector URL.
 */
export async function synthesizeSpeechFromText(
  synthesizer: TextToAudioPipeline,
  englishText: string,
  options?: {
    readonly speakerEmbeddingsUrl?: string
  },
): Promise<SynthesizedSpeechAudio> {
  const text = prepareTextForSpeechSynthesis(englishText)
  if (!text) {
    return {
      samples: new Float32Array(0),
      sampleRateInHertz: 16_000,
    }
  }

  const speakerEmbeddingsUrl =
    options?.speakerEmbeddingsUrl ?? DEFAULT_SPEECHT5_SPEAKER_EMBEDDINGS_URL

  const output = await synthesizer(text, {
    speaker_embeddings: speakerEmbeddingsUrl,
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
