/**
 * SmolLM2 coaching pass: one dynamic rewrite + a short Spanish reason.
 * Phrase tables live in the fallback rewriter, not here.
 */

import type { Chat, TextGenerationOutput, TextGenerationPipeline } from '@huggingface/transformers'
import { isDegenerateTranscript } from './transcription-text'
import { normalizeUtteranceForComparison } from './communication-suggestion-analysis'
import type { CommunicationSuggestion } from './communication-suggestions'

export const DEFAULT_COACHING_MAX_NEW_TOKENS = 72
export const COMMUNICATION_COACHING_TIMEOUT_MS = 8_000

export interface CommunicationCoachingDraft {
  readonly tryThisEn: string
  readonly whyEs: string
}

export interface CommunicationCoachingGenerationInput {
  readonly scenarioContextEn: string
  readonly lastTutorLineEn: string
  readonly userUtteranceEn: string
}

export interface CommunicationCoachingGenerationResult {
  readonly draft: CommunicationCoachingDraft | null
  readonly usedFallback: boolean
}

const GENERIC_WHY_ES = 'Misma idea, más natural en esta situación.'

export function buildCoachingChatMessages(input: CommunicationCoachingGenerationInput): Chat {
  const tutorLine = input.lastTutorLineEn.trim()
  return [
    {
      role: 'system',
      content:
        'You coach spoken English. Reply with exactly two lines and nothing else. TRY: one better English sentence with the same meaning. WHY: one short Spanish reason that does not copy TRY.',
    },
    {
      role: 'user',
      content: [
        input.scenarioContextEn.trim(),
        tutorLine ? `They just said: ${tutorLine}` : '',
        `Student said: ${input.userUtteranceEn.trim()}`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ]
}

function cleanCoachingLine(raw: string): string {
  return raw
    .replace(/<\|im_end\|>/gi, ' ')
    .replace(/<\|im_start\|>\s*/gi, ' ')
    .replace(/^(TRY|WHY)\s*:\s*/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseCoachingOutput(raw: string): CommunicationCoachingDraft | null {
  const text = raw.replace(/\r/g, '').trim()
  if (!text) {
    return null
  }
  const tryMatch = text.match(/TRY:\s*(.+)/i)
  const whyMatch = text.match(/WHY:\s*(.+)/i)
  const tryThisEn = cleanCoachingLine(tryMatch?.[1] ?? '')
  if (!tryThisEn) {
    return null
  }
  const whyEs = cleanCoachingLine(whyMatch?.[1] ?? '')
  return {
    tryThisEn,
    whyEs: whyEs || GENERIC_WHY_ES,
  }
}

export function isAcceptableCoachingDraft(
  draft: CommunicationCoachingDraft,
  userUtteranceEn: string,
): boolean {
  const tryThis = draft.tryThisEn.trim()
  const why = draft.whyEs.trim()
  if (tryThis.length < 8 || tryThis.length > 180) {
    return false
  }
  if (isDegenerateTranscript(tryThis)) {
    return false
  }
  const letterCount = (tryThis.match(/[A-Za-z]/g) ?? []).length
  if (letterCount < 6 || letterCount / tryThis.replace(/\s/g, '').length < 0.55) {
    return false
  }
  const originalNorm = normalizeUtteranceForComparison(userUtteranceEn)
  const tryNorm = normalizeUtteranceForComparison(tryThis)
  if (tryNorm === `could you tell me ${originalNorm}`) {
    return false
  }
  if (why.toLowerCase().includes(tryThis.toLowerCase())) {
    return false
  }
  const contentWords = originalNorm.split(/\s+/).filter((word) => word.length >= 4)
  if (contentWords.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(tryThis))) {
    return true
  }
  const originalAsks =
    /\b(who|where|what|when|why|how)\b/i.test(userUtteranceEn) || userUtteranceEn.includes('?')
  return originalAsks && /\b(who|where|what|when|why|how|name|sorry|excuse)\b/i.test(tryThis)
}

function extractGeneratedText(output: TextGenerationOutput | TextGenerationOutput[]): string {
  const first = Array.isArray(output) ? output[0] : output
  if (!first || typeof first !== 'object' || !('generated_text' in first)) {
    return ''
  }
  const generated = (first as { generated_text?: unknown }).generated_text
  if (typeof generated === 'string') {
    return generated
  }
  if (!Array.isArray(generated) || generated.length === 0) {
    return ''
  }
  const last = generated[generated.length - 1]
  if (typeof last === 'object' && last !== null && 'content' in last) {
    const content = (last as { content?: unknown }).content
    return typeof content === 'string' ? content : ''
  }
  return typeof generated[0] === 'string' ? generated[0] : ''
}

export async function generateCommunicationCoaching(
  generator: TextGenerationPipeline,
  input: CommunicationCoachingGenerationInput,
): Promise<CommunicationCoachingGenerationResult> {
  const userUtterance = input.userUtteranceEn.trim()
  if (!userUtterance) {
    return { draft: null, usedFallback: true }
  }
  try {
    const output = await generator(buildCoachingChatMessages(input), {
      max_new_tokens: DEFAULT_COACHING_MAX_NEW_TOKENS,
      do_sample: false,
      temperature: 0,
      return_full_text: false,
    })
    const parsed = parseCoachingOutput(extractGeneratedText(output))
    if (!parsed || !isAcceptableCoachingDraft(parsed, userUtterance)) {
      return { draft: null, usedFallback: true }
    }
    return { draft: parsed, usedFallback: false }
  } catch (error) {
    console.warn('SmolLM2 coaching generation failed; falling back to structural tips.', error)
    return { draft: null, usedFallback: true }
  }
}

export function mergeCoachingIntoSuggestions(
  structural: readonly CommunicationSuggestion[],
  draft: CommunicationCoachingDraft,
  youSaidEn: string,
): readonly CommunicationSuggestion[] {
  const vocabulary = structural.filter((item) => item.type === 'vocabulario')
  const naturalidad: CommunicationSuggestion = {
    type: 'naturalidad',
    text: draft.whyEs,
    youSaidEn,
    tryThisEn: draft.tryThisEn,
  }
  return [...vocabulary, naturalidad].slice(0, 3)
}

export async function resolveDynamicCommunicationSuggestions(options: {
  readonly structural: readonly CommunicationSuggestion[]
  readonly youSaidEn: string
  readonly generateCoaching: () => Promise<CommunicationCoachingGenerationResult>
  readonly timeoutMs?: number
}): Promise<readonly CommunicationSuggestion[]> {
  const timeoutMs = options.timeoutMs ?? COMMUNICATION_COACHING_TIMEOUT_MS
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<CommunicationCoachingGenerationResult>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ draft: null, usedFallback: true }), timeoutMs)
  })
  try {
    const result = await Promise.race([options.generateCoaching(), timeoutPromise])
    if (result.usedFallback || !result.draft) {
      return options.structural
    }
    return mergeCoachingIntoSuggestions(options.structural, result.draft, options.youSaidEn)
  } catch (error) {
    console.warn('Dynamic communication coaching failed; using structural tips.', error)
    return options.structural
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle)
    }
  }
}
