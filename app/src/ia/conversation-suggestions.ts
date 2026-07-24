/**
 * Tutor reply helpers: quality checks for optional LLM output.
 * Primary dialogue uses curated multi-turn scripts in `ui/practice-scenarios`
 * (instant + coherent). SmolLM2 remains available for optional paraphrase
 * but must pass {@link isPlausibleTutorReply} or we keep the scripted line.
 */

import { pipeline } from '@huggingface/transformers'
import type {
  PretrainedModelOptions,
  TextGenerationOutput,
  TextGenerationPipeline,
} from '@huggingface/transformers'
import { modelRegistry } from './model-registry'
import { onnxDtypeForDevice } from './onnx-dtype'
import type { OnnxInferenceDevice } from './resolve-inference-device'
import { isDegenerateTranscript } from './transcription-text'

export type ModelDownloadProgressCallback = NonNullable<PretrainedModelOptions['progress_callback']>

/** Keep LLM replies short for latency and TTS. */
export const DEFAULT_TUTOR_REPLY_MAX_NEW_TOKENS = 36

export const MAXIMUM_TUTOR_REPLY_CHARACTERS = 180

export interface TutorReplyGenerationInput {
  readonly scenarioContextEn: string
  readonly lastTutorLineEn: string
  readonly userUtteranceEn: string
  readonly fallbackReplyEn: string
}

export interface ChatMessageForGeneration {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export async function loadConversationSuggestionGenerator(
  device: OnnxInferenceDevice,
  onProgress?: ModelDownloadProgressCallback,
): Promise<TextGenerationPipeline> {
  const { huggingFaceModelId, revision } = modelRegistry.conversationSuggestions
  const dtype = onnxDtypeForDevice(device)

  const generator = await pipeline('text-generation', huggingFaceModelId, {
    revision,
    device,
    dtype,
    progress_callback: onProgress,
  })
  return generator as unknown as TextGenerationPipeline
}

export function buildTutorReplyChatMessages(
  input: TutorReplyGenerationInput,
): ChatMessageForGeneration[] {
  const systemContent = [
    'You are a role-play partner for English practice.',
    input.scenarioContextEn.trim(),
    'Output ONLY one short spoken reply in simple English (max 2 sentences).',
    'Answer the student naturally. Do not explain rules. Do not translate. Do not use lists.',
  ].join(' ')

  const userContent = [
    `Your previous line: ${input.lastTutorLineEn.trim()}`,
    `Student: ${input.userUtteranceEn.trim()}`,
    'Your reply:',
  ].join('\n')

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

export function cleanGeneratedTutorReply(rawGeneratedText: string): string {
  let text = rawGeneratedText.replace(/\r/g, '').trim()
  if (!text) {
    return ''
  }

  text = text
    .replace(/<\|endoftext\|>/gi, ' ')
    .replace(/<\|im_end\|>/gi, ' ')
    .replace(/<\|im_start\|>\s*/gi, ' ')
    .replace(/^(system|user|assistant)\b[:\s]*/gim, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Drop leading labels the model sometimes echoes.
  text = text.replace(/^(tutor|waiter|agent|interviewer)\s*:\s*/i, '').trim()

  const sentenceMatch = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
  if (sentenceMatch && sentenceMatch.length > 0) {
    text = sentenceMatch
      .slice(0, 2)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .join(' ')
  }

  if (text.length > MAXIMUM_TUTOR_REPLY_CHARACTERS) {
    text = `${text.slice(0, MAXIMUM_TUTOR_REPLY_CHARACTERS).trim()}…`
  }

  if (!text || isDegenerateTranscript(text)) {
    return ''
  }

  return text
}

/**
 * Reject nonsense LLM output so the UI never shows incoherent tutor lines.
 */
export function isPlausibleTutorReply(
  reply: string,
  userUtteranceEn: string,
): boolean {
  const text = reply.trim()
  if (text.length < 8 || text.length > MAXIMUM_TUTOR_REPLY_CHARACTERS + 5) {
    return false
  }

  // Must look like English words (letters + basic punctuation).
  const letterCount = (text.match(/[A-Za-z]/g) ?? []).length
  if (letterCount < 6) {
    return false
  }
  if (letterCount / text.replace(/\s/g, '').length < 0.55) {
    return false
  }

  // Reject pure echo of the student.
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (normalize(text) === normalize(userUtteranceEn)) {
    return false
  }

  // Reject common junk patterns from tiny models.
  if (/\b(as an ai|language model|i cannot|i'm sorry,? but i)\b/i.test(text)) {
    return false
  }
  if (/(.)\1{5,}/.test(text)) {
    return false
  }

  return !isDegenerateTranscript(text)
}

export interface TutorReplyGenerationResult {
  readonly tutorReplyText: string
  readonly usedFallback: boolean
}

/**
 * Optional LLM paraphrase. On any doubt, returns the curated fallback (preferred for demos).
 */
export async function generateTutorReply(
  generator: TextGenerationPipeline,
  input: TutorReplyGenerationInput,
  options?: {
    readonly maxNewTokens?: number
  },
): Promise<TutorReplyGenerationResult> {
  const fallback = input.fallbackReplyEn.trim()
  const userUtterance = input.userUtteranceEn.trim()
  if (!userUtterance) {
    return { tutorReplyText: fallback, usedFallback: true }
  }

  const messages = buildTutorReplyChatMessages(input)
  const maxNewTokens = options?.maxNewTokens ?? DEFAULT_TUTOR_REPLY_MAX_NEW_TOKENS

  try {
    const output = await generator(messages, {
      max_new_tokens: maxNewTokens,
      do_sample: false,
      temperature: 0,
      return_full_text: false,
    })
    const generatedText = extractGeneratedText(output)
    const cleaned = cleanGeneratedTutorReply(generatedText)
    if (!cleaned || !isPlausibleTutorReply(cleaned, userUtterance)) {
      return { tutorReplyText: fallback, usedFallback: true }
    }
    return { tutorReplyText: cleaned, usedFallback: false }
  } catch {
    return { tutorReplyText: fallback, usedFallback: true }
  }
}

function extractGeneratedText(
  output: TextGenerationOutput | TextGenerationOutput[],
): string {
  const first = Array.isArray(output) ? output[0] : output
  if (!first) {
    return ''
  }
  if (typeof first === 'object' && first !== null && 'generated_text' in first) {
    const generated = (first as { generated_text?: unknown }).generated_text
    if (typeof generated === 'string') {
      return generated
    }
    if (Array.isArray(generated) && typeof generated[0] === 'string') {
      return generated[0]
    }
  }
  return ''
}
