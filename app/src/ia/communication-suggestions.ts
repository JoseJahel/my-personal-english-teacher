/**
 * Rule-based communication suggestions (vocabulario/fluidez/naturalidad).
 * Offline, deterministic — no LLM dependency. Runs after a successful user
 * turn and is rendered in its own panel, separate from the tutor's reply.
 *
 * RF-14: this is the "solo reglas" acceptable scope from issue #60. An LLM
 * enrichment pass (SmolLM2) can be layered on top later without changing
 * this contract.
 */

import type { PracticeScenarioId } from '../ui/practice-scenarios'

export type CommunicationSuggestionType = 'vocabulario' | 'fluidez' | 'naturalidad'

export interface CommunicationSuggestion {
  readonly textEn: string
  readonly type: CommunicationSuggestionType
}

export interface CommunicationSuggestionsInput {
  readonly scenarioId: PracticeScenarioId
  readonly userUtteranceEn: string
  readonly correctedUtteranceEn: string
  readonly userTurnIndex: number
}

const MAXIMUM_SUGGESTIONS = 3

/** Common hispanic-learner phrasing swaps, checked against the corrected utterance. */
const VOCABULARY_TIPS: readonly { pattern: RegExp; textEn: string }[] = [
  {
    pattern: /\bi want\b/i,
    textEn: "Try \"I would like\" instead of \"I want\" — it sounds more polite.",
  },
  {
    pattern: /\bgive me\b/i,
    textEn: "Try \"Could I have...\" instead of \"give me\" — it sounds more polite here.",
  },
  {
    pattern: /\bi am agree\b/i,
    textEn: "Say \"I agree\" (no \"am\") — that's the natural form in English.",
  },
  {
    pattern: /\bvery good\b/i,
    textEn: "Try \"great\" or \"excellent\" instead of \"very good\" for a more natural tone.",
  },
  {
    pattern: /\bhow much cost\b/i,
    textEn: "Try \"How much does it cost?\" — English needs \"does\" in this question.",
  },
]

const NATURALNESS_TIPS_BY_SCENARIO: Record<PracticeScenarioId, readonly string[]> = {
  restaurant: [
    'Native speakers often end requests with "please": "Could I have a coffee, please?"',
    'Try "I\'ll have the..." instead of "I want the..." — it\'s the natural way to order.',
    'Adding "for me" softens the request: "A coffee for me, please."',
    'You can thank the waiter naturally with "That sounds great, thank you."',
  ],
  airport: [
    'Try "Could you tell me..." instead of a direct question — it sounds more polite at a counter.',
    'Native speakers say "my flight" or "my gate", not just "flight" or "gate".',
    'Try "I was wondering if..." to ask something politely at the desk.',
    'You can confirm politely with "Just to confirm, that\'s gate B12?"',
  ],
  'job-interview': [
    'Try "I have experience in..." instead of "I have experiencia" — keep it fully in English.',
    'Native speakers often start with "Well," to sound natural before answering.',
    'Try "I\'m particularly interested in..." to sound more professional.',
    'You can end with "Thank you for the opportunity" — it sounds polished.',
  ],
}

const FLUENCY_TIP_SHORT_UTTERANCE =
  'Your sentence was quite short — try adding one more detail, like a reason or an example.'

const FLUENCY_TIP_GENERIC =
  'Try connecting your ideas with words like "and", "but", or "because" for smoother sentences.'

function pickNaturalnessTip(scenarioId: PracticeScenarioId, userTurnIndex: number): string {
  const tips = NATURALNESS_TIPS_BY_SCENARIO[scenarioId]
  const safeIndex = Math.max(0, Math.min(userTurnIndex, tips.length - 1))
  return tips[safeIndex] ?? tips[0]
}

function pickVocabularyTip(correctedUtteranceEn: string): string | null {
  const match = VOCABULARY_TIPS.find((tip) => tip.pattern.test(correctedUtteranceEn))
  return match?.textEn ?? null
}

function pickFluencyTip(userUtteranceEn: string): string {
  const wordCount = userUtteranceEn.trim().split(/\s+/).filter(Boolean).length
  return wordCount > 0 && wordCount < 4 ? FLUENCY_TIP_SHORT_UTTERANCE : FLUENCY_TIP_GENERIC
}

/**
 * Builds 1–3 offline communication suggestions for the last user turn.
 * Always returns at least one suggestion (never an empty, silent panel).
 */
export function buildCommunicationSuggestions(
  input: CommunicationSuggestionsInput,
): readonly CommunicationSuggestion[] {
  const suggestions: CommunicationSuggestion[] = []

  suggestions.push({
    type: 'naturalidad',
    textEn: pickNaturalnessTip(input.scenarioId, input.userTurnIndex),
  })

  const vocabularyTipText = pickVocabularyTip(input.correctedUtteranceEn)
  if (vocabularyTipText) {
    suggestions.push({ type: 'vocabulario', textEn: vocabularyTipText })
  }

  if (suggestions.length < MAXIMUM_SUGGESTIONS) {
    suggestions.push({ type: 'fluidez', textEn: pickFluencyTip(input.userUtteranceEn) })
  }

  return suggestions.slice(0, MAXIMUM_SUGGESTIONS)
}
