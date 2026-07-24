/**
 * Whisper ASR adapter for transformers.js (runs inside the inference worker).
 * Device-aware dtype: fp32 on WebGPU, q8 on WASM (q8+WebGPU caused token garbage).
 */

import { pipeline } from '@huggingface/transformers'
import type {
  AutomaticSpeechRecognitionPipeline,
  PretrainedModelOptions,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'
import { onnxDtypeForDevice } from './onnx-dtype'
import type { OnnxInferenceDevice } from './resolve-inference-device'

/** Progress callback type from transformers.js PretrainedModelOptions. */
export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

export type ModelDownloadProgressEvent = Parameters<ModelDownloadProgressCallback>[0]

/** Loads (or reuses cached) Whisper pipeline from the model registry. */
export async function loadSpeechRecognizer(
  device: OnnxInferenceDevice,
  onProgress?: ModelDownloadProgressCallback,
): Promise<AutomaticSpeechRecognitionPipeline> {
  const { huggingFaceModelId, revision } = modelRegistry.automaticSpeechRecognition
  const dtype = onnxDtypeForDevice(device)

  return pipeline<'automatic-speech-recognition'>(
    'automatic-speech-recognition',
    huggingFaceModelId,
    {
      revision,
      device,
      dtype,
      progress_callback: onProgress,
    },
  )
}

/**
 * Cap decoder length from audio duration so a broken run cannot emit
 * thousands of tokens (the "biasesVIDEO…" loop).
 */
export function maxNewTokensForWhisperDuration(durationSeconds: number): number {
  // ~rough upper bound for English ASR tokens; keep a floor for short clips.
  const estimated = Math.ceil(durationSeconds * 12) + 16
  return Math.min(180, Math.max(24, estimated))
}

/**
 * Transcribes mono 16 kHz samples. Does not pass language/task options —
 * whisper-tiny.en is English-only and transformers.js rejects those flags.
 */
export async function transcribeAudioSamples(
  recognizer: AutomaticSpeechRecognitionPipeline,
  samples16kHz: Float32Array,
): Promise<string> {
  // Own contiguous buffer: transferable postMessage can leave exotic views.
  const monoSamples = new Float32Array(samples16kHz.length)
  monoSamples.set(samples16kHz)

  const durationSeconds = monoSamples.length / 16000
  const maxNewTokens = maxNewTokensForWhisperDuration(durationSeconds)

  // Short practice utterances: avoid chunking (helps whisper-tiny.en quality).
  // Only chunk very long clips (>25 s) so stride logic does not mangle short speech.
  // Greedy decoding (temperature 0, no sampling) is more stable for quiet speech.
  const generationOptions = {
    max_new_tokens: maxNewTokens,
    temperature: 0,
    do_sample: false,
    return_timestamps: false as const,
    ...(durationSeconds > 25
      ? {
          chunk_length_s: 30,
          stride_length_s: 5,
        }
      : {}),
  }

  const output = await recognizer(monoSamples, generationOptions)

  const result = Array.isArray(output) ? output[0] : output
  return (result?.text ?? '').trim()
}
