/**
 * Whisper ASR adapter for transformers.js (runs inside the inference worker).
 * Tries WebGPU first, falls back to WASM.
 */

import { pipeline } from '@huggingface/transformers'
import type {
  AutomaticSpeechRecognitionPipeline,
  PretrainedModelOptions,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'

/** Progress callback type from transformers.js PretrainedModelOptions. */
export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

export type ModelDownloadProgressEvent = Parameters<ModelDownloadProgressCallback>[0]

/** Loads (or reuses cached) Whisper pipeline from the model registry. */
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
      'ASR pipeline could not start with WebGPU; retrying with WASM.',
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
 * Transcribes mono 16 kHz samples. Does not pass language/task options —
 * whisper-tiny.en is English-only and transformers.js rejects those flags.
 */
export async function transcribeAudioSamples(
  recognizer: AutomaticSpeechRecognitionPipeline,
  samples16kHz: Float32Array,
): Promise<string> {
  // Short practice utterances: avoid chunking (helps whisper-tiny.en quality).
  // Only chunk very long clips (>25 s) so stride logic does not mangle short speech.
  const durationSeconds = samples16kHz.length / 16000
  const output =
    durationSeconds > 25
      ? await recognizer(samples16kHz, {
          chunk_length_s: 30,
          stride_length_s: 5,
        })
      : await recognizer(samples16kHz)

  const result = Array.isArray(output) ? output[0] : output
  return (result?.text ?? '').trim()
}
