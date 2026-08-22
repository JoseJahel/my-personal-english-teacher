/**
 * Pure parse of one practice turn so tips can quote the learner's words
 * instead of rotating canned scenario lines.
 */

import { diffEnglishWords } from './grammar-correction-diff'
import type { PracticeScenarioId } from '../ui/practice-scenarios'

export type PracticeUtteranceIntent =
  | 'order'
  | 'request'
  | 'question'
  | 'thanks'
  | 'introduction'
  | 'experience'
  | 'agreement'
  | 'statement'

export interface WordSubstitution {
  readonly from: string
  readonly to: string
}

export interface PracticeUtteranceAnalysis {
  readonly scenarioId: PracticeScenarioId
  readonly original: string
  readonly corrected: string
  readonly display: string
  readonly lastTutorLineEn: string
  readonly words: readonly string[]
  readonly wordCount: number
  readonly isQuestion: boolean
  readonly isShort: boolean
  readonly hasPlease: boolean
  readonly hasPoliteModal: boolean
  readonly intent: PracticeUtteranceIntent
  readonly complement: string | null
  readonly substitutions: readonly WordSubstitution[]
  readonly addedWords: readonly string[]
  readonly removedWords: readonly string[]
}

const REQUEST_PREFIX =
  /^(?:i\s+(?:would\s+like|want|need)|i'd\s+like|i'll\s+have|i\s+will\s+have|give\s+me|can\s+i\s+(?:have|get)|could\s+i\s+(?:have|get)|may\s+i\s+(?:have|get))\s+(.+)$/i

const WHERE_IS = /^where\s+(?:is|are)\s+(.+)$/i
const EXPERIENCE_WITH = /\bexperience(?:\s+working)?\s+(?:with|in|on)\s+(.+)$/i
const MY_NAME_IS = /\bmy name is\s+([^.,]+)/i

export function collapseUtteranceWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function stripUtteranceDecoration(text: string): string {
  return collapseUtteranceWhitespace(text)
    .replace(/[.?!]+$/g, '')
    .replace(/,?\s+please$/i, '')
    .trim()
}

export function normalizeUtteranceForComparison(text: string): string {
  return collapseUtteranceWhitespace(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitWords(text: string): string[] {
  return collapseUtteranceWhitespace(text)
    .split(/\s+/)
    .filter(Boolean)
}

function collectDiffParts(original: string, corrected: string): {
  substitutions: WordSubstitution[]
  addedWords: string[]
  removedWords: string[]
} {
  const tokens = diffEnglishWords(original, corrected)
  const substitutions: WordSubstitution[] = []
  const addedWords: string[] = []
  const removedWords: string[] = []
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]
    const next = tokens[index + 1]
    if (token.type === 'substituted-old' && next?.type === 'substituted-new') {
      substitutions.push({ from: token.text, to: next.text })
      index += 2
      continue
    }
    if (token.type === 'added') {
      addedWords.push(token.text)
    } else if (token.type === 'removed') {
      removedWords.push(token.text)
    }
    index += 1
  }
  return { substitutions, addedWords, removedWords }
}

function detectIntent(
  stripped: string,
  isQuestion: boolean,
  hasRequestVerb: boolean,
  scenarioId: PracticeScenarioId,
): PracticeUtteranceIntent {
  if (/^(thanks|thank you|thx)\b/i.test(stripped)) {
    return 'thanks'
  }
  if (/^(yes|yeah|yep|ok|okay|sure|i agree|i am agree)\b/i.test(stripped)) {
    return 'agreement'
  }
  if (/\bexperiencia\b/i.test(stripped) || EXPERIENCE_WITH.test(stripped) || /\bexperience\b/i.test(stripped)) {
    return 'experience'
  }
  if (MY_NAME_IS.test(stripped) || /\bi(?:'m| am) a\b/i.test(stripped)) {
    return 'introduction'
  }
  if (
    isQuestion &&
    !/^(where|what|when|which|who|how|why)\b/i.test(stripped) &&
    scenarioId === 'restaurant' &&
    stripped.split(/\s+/).length < 4
  ) {
    return 'order'
  }
  if (isQuestion) {
    return 'question'
  }
  if (hasRequestVerb) {
    return scenarioId === 'restaurant' ? 'order' : 'request'
  }
  return 'statement'
}

function extractComplement(stripped: string, intent: PracticeUtteranceIntent): string | null {
  const requestMatch = stripped.match(REQUEST_PREFIX)
  if (requestMatch?.[1]) {
    return requestMatch[1].trim()
  }
  const whereMatch = stripped.match(WHERE_IS)
  if (whereMatch?.[1]) {
    return whereMatch[1].trim()
  }
  const experienceMatch = stripped.match(EXPERIENCE_WITH)
  if (experienceMatch?.[1]) {
    return experienceMatch[1].trim()
  }
  const nameMatch = stripped.match(MY_NAME_IS)
  if (nameMatch?.[1]) {
    return nameMatch[1].trim()
  }
  if (intent === 'question' || intent === 'statement') {
    return null
  }
  return stripped || null
}

export function analyzePracticeUtterance(input: {
  readonly scenarioId: PracticeScenarioId
  readonly userUtteranceEn: string
  readonly correctedUtteranceEn: string
  readonly lastTutorLineEn?: string
}): PracticeUtteranceAnalysis {
  const original = collapseUtteranceWhitespace(input.userUtteranceEn)
  const corrected = collapseUtteranceWhitespace(input.correctedUtteranceEn) || original
  const meaningfullyCorrected =
    normalizeUtteranceForComparison(original) !== normalizeUtteranceForComparison(corrected)
  const display = meaningfullyCorrected ? corrected : original
  const stripped = stripUtteranceDecoration(display)
  const words = splitWords(display)
  const isQuestion = /\?$/.test(display) || /^(where|what|when|which|who|how|why)\b/i.test(stripped)
  const hasRequestVerb = REQUEST_PREFIX.test(stripped)
  const intent = detectIntent(stripped, isQuestion, hasRequestVerb, input.scenarioId)
  const { substitutions, addedWords, removedWords } = collectDiffParts(original, corrected)

  return {
    scenarioId: input.scenarioId,
    original,
    corrected,
    display,
    lastTutorLineEn: collapseUtteranceWhitespace(input.lastTutorLineEn ?? ''),
    words,
    wordCount: words.length,
    isQuestion,
    isShort: words.length > 0 && words.length < 5,
    hasPlease: /\bplease\b/i.test(display),
    hasPoliteModal: /\b(would like|could i|could you|may i|i'd like)\b/i.test(display),
    intent,
    complement: extractComplement(stripped, intent),
    substitutions,
    addedWords,
    removedWords,
  }
}
