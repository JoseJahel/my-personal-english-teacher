/**
 * T5 grammar-correction adapter for transformers.js (runs inside the worker).
 * Device-aware dtype (fp32 WebGPU / q8 WASM), same pattern as ASR.
 */

import { pipeline } from '@huggingface/transformers'
import type {
  PretrainedModelOptions,
  Text2TextGenerationOutput,
  Text2TextGenerationPipeline,
  Text2TextGenerationSingle,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'
import { onnxDtypeForDevice } from './onnx-dtype'
import type { OnnxInferenceDevice } from './resolve-inference-device'
import { isDegenerateTranscript } from './transcription-text'

export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

/** Loads (or reuses cached) T5 text2text pipeline from the model registry. */
export async function loadGrammarCorrector(
  device: OnnxInferenceDevice,
  onProgress?: ModelDownloadProgressCallback,
): Promise<Text2TextGenerationPipeline> {
  const { huggingFaceModelId, revision } = modelRegistry.grammarCorrection
  const dtype = onnxDtypeForDevice(device)

  return pipeline<'text2text-generation'>('text2text-generation', huggingFaceModelId, {
    revision,
    device,
    dtype,
    progress_callback: onProgress,
  })
}

/** Prefix required by vennify/t5-base-grammar-correction (and its ONNX port). */
export function buildGrammarCorrectionInput(rawEnglishText: string): string {
  return `grammar: ${rawEnglishText.trim()}`
}

/** Scale generation budget with input length; avoid long token loops. */
export function maxNewTokensForGrammarInput(englishText: string): number {
  const wordCount = englishText.trim().split(/\s+/).filter(Boolean).length
  return Math.min(48, Math.max(12, wordCount * 2 + 8))
}

function firstText2TextGenerationResult(
  output: Text2TextGenerationOutput | Text2TextGenerationOutput[],
): Text2TextGenerationSingle | undefined {
  const [firstElement] = output
  return Array.isArray(firstElement) ? firstElement[0] : firstElement
}

/**
 * Runs grammar correction on English text with a loaded pipeline.
 * If the model emits a degenerate loop, returns the original text unchanged.
 */
export async function correctEnglishGrammar(
  corrector: Text2TextGenerationPipeline,
  englishText: string,
): Promise<string> {
  const trimmedInput = englishText.trim()
  if (!trimmedInput) {
    return ''
  }

  const output = await corrector(buildGrammarCorrectionInput(trimmedInput), {
    max_new_tokens: maxNewTokensForGrammarInput(trimmedInput),
  })
  const result = firstText2TextGenerationResult(output)
  const generatedText = (result?.generated_text ?? '').trim()

  if (!generatedText || isDegenerateTranscript(generatedText)) {
    return trimmedInput
  }

  return generatedText
}

function normalizeEnglishTextForComparison(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[.!?]+$/, '')
}

/**
 * True when corrected text equals the transcript ignoring case, spacing,
 * and trailing punctuation (UI "no corrections needed" case).
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
