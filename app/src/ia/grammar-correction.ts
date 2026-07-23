/**
 * T5 grammar-correction adapter for transformers.js (runs inside the worker).
 * WebGPU with WASM fallback, same pattern as ASR.
 */

import { pipeline } from '@huggingface/transformers'
import type {
  PretrainedModelOptions,
  Text2TextGenerationOutput,
  Text2TextGenerationPipeline,
  Text2TextGenerationSingle,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'

export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

const MAX_NEW_TOKENS_FOR_GRAMMAR_CORRECTION = 128

/** Prefix required by vennify/t5-base-grammar-correction (and its ONNX port). */
export function buildGrammarCorrectionInput(rawEnglishText: string): string {
  return `grammar: ${rawEnglishText.trim()}`
}

/** Loads (or reuses cached) T5 text2text pipeline from the model registry. */
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
      'Grammar pipeline could not start with WebGPU; retrying with WASM.',
      webgpuError,
    )
    return pipeline<'text2text-generation'>('text2text-generation', huggingFaceModelId, {
      revision,
      device: 'wasm',
      progress_callback: onProgress,
    })
  }
}

function firstText2TextGenerationResult(
  output: Text2TextGenerationOutput | Text2TextGenerationOutput[],
): Text2TextGenerationSingle | undefined {
  const [firstElement] = output
  return Array.isArray(firstElement) ? firstElement[0] : firstElement
}

/** Runs grammar correction on English text with a loaded pipeline. */
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
