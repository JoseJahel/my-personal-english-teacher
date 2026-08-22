/**
 * Communication coaching for the last user turn (RF-14).
 * Offline and deterministic: every tip quotes the learner's words and offers
 * a rewrite of that same sentence. No rotating generic scenario lines.
 */

import type { PracticeScenarioId } from '../ui/practice-scenarios'
import {
  analyzePracticeUtterance,
  normalizeUtteranceForComparison,
  type PracticeUtteranceAnalysis,
} from './communication-suggestion-analysis'
import { expandForFluency, rewriteAsNative } from './communication-suggestion-rewrites'

export type CommunicationSuggestionType = 'vocabulario' | 'fluidez' | 'naturalidad'

export interface CommunicationSuggestion {
  readonly type: CommunicationSuggestionType
  /** Spanish coach line. English belongs in youSaidEn / tryThisEn. */
  readonly text: string
  readonly youSaidEn: string
  readonly tryThisEn: string | null
}

export interface CommunicationSuggestionsInput {
  readonly scenarioId: PracticeScenarioId
  readonly userUtteranceEn: string
  readonly correctedUtteranceEn: string
  readonly userTurnIndex: number
  readonly lastTutorLineEn?: string
}

const MAXIMUM_SUGGESTIONS = 3

const LEARNER_FORM_TIPS: readonly {
  readonly pattern: RegExp
  readonly coach: (analysis: PracticeUtteranceAnalysis, rewrite: string) => string
}[] = [
  {
    pattern: /\bi want\b/i,
    coach: (_analysis, rewrite) =>
      `«I want» se entiende, pero suena directo. Con tu pedido, «I'd like» o «Could I have» quedan así: «${rewrite}».`,
  },
  {
    pattern: /\bgive me\b/i,
    coach: (_analysis, rewrite) =>
      `«Give me» es demasiado brusco aquí. Una forma educada de pedir lo mismo: «${rewrite}».`,
  },
  {
    pattern: /\bi am agree\b/i,
    coach: () => 'En inglés se dice «I agree», sin «am».',
  },
  {
    pattern: /\bhow much cost\b/i,
    coach: () => 'La pregunta natural es «How much does it cost?» — hace falta «does».',
  },
  {
    pattern: /\bi have \d+ years?\b/i,
    coach: (analysis) => {
      const years = analysis.display.match(/\b(\d+)\s+years?\b/i)?.[1]
      return years
        ? `La edad se dice «I am ${years} years old», no «I have ${years} years».`
        : 'La edad se dice «I am … years old», no «I have … years».'
    },
  },
  {
    pattern: /\bfor to\b/i,
    coach: () => 'Después de «for» no va un infinitivo: «I came to practice», no «for to practice».',
  },
  {
    pattern: /\bexperiencia\b/i,
    coach: (_analysis, rewrite) =>
      `Mantén esa idea en inglés. En una entrevista quedaría: «${rewrite}».`,
  },
]

export { normalizeUtteranceForComparison }

const CONTENT_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'i',
  'i\'m',
  'i\'d',
  'i\'ll',
  'you',
  'we',
  'my',
  'me',
  'to',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'but',
  'with',
  'please',
  'is',
  'are',
  'was',
  'were',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'would',
  'could',
  'can',
  'like',
  'want',
  'yes',
  'yeah',
  'ok',
  'okay',
])

export function suggestionReferencesUtterance(
  suggestion: CommunicationSuggestion,
  utteranceEn: string,
): boolean {
  const haystack = `${suggestion.text} ${suggestion.youSaidEn} ${suggestion.tryThisEn ?? ''}`.toLowerCase()
  const original = utteranceEn.trim()
  if (!original) {
    return false
  }
  if (haystack.includes(normalizeUtteranceForComparison(original))) {
    return true
  }
  const contentWords = original
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !CONTENT_STOP_WORDS.has(word))
  if (contentWords.length === 0) {
    return haystack.includes(original.toLowerCase())
  }
  return contentWords.some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(haystack))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sameSpokenLine(left: string, right: string): boolean {
  return normalizeUtteranceForComparison(left) === normalizeUtteranceForComparison(right)
}

function buildVocabularySuggestion(
  analysis: PracticeUtteranceAnalysis,
  rewrite: string,
): CommunicationSuggestion | null {
  const source = `${analysis.original} ${analysis.corrected}`
  const learnerForm = LEARNER_FORM_TIPS.find((tip) => tip.pattern.test(source))
  if (learnerForm) {
    return {
      type: 'vocabulario',
      text: learnerForm.coach(analysis, rewrite),
      youSaidEn: analysis.original,
      tryThisEn: sameSpokenLine(analysis.original, rewrite) ? null : rewrite,
    }
  }

  const firstSwap = analysis.substitutions[0]
  if (firstSwap && firstSwap.from.toLowerCase() !== firstSwap.to.toLowerCase()) {
    return {
      type: 'vocabulario',
      text: `En tu frase, «${firstSwap.from}» queda más natural como «${firstSwap.to}». La versión clara: «${analysis.corrected}».`,
      youSaidEn: analysis.original,
      tryThisEn: analysis.corrected,
    }
  }
  return null
}

function naturalnessCoach(analysis: PracticeUtteranceAnalysis, rewrite: string): string {
  if (analysis.intent === 'order' || analysis.intent === 'request') {
    if (analysis.hasPoliteModal) {
      return 'El pedido ya suena educado. En el mostrador a veces se usa «Could I have…» con las mismas cosas.'
    }
    return 'En este contexto «I want» / «give me» suenan directos. La forma educada está en «Prueba esto».'
  }
  if (analysis.intent === 'question') {
    if (sameSpokenLine(analysis.display, rewrite)) {
      return `Tu pregunta «${analysis.display}» ya está bien formada. No hace falta cambiarla.`
    }
    return 'Misma pregunta, un poco más natural. La versión está en «Prueba esto».'
  }
  if (analysis.intent === 'experience') {
    return 'Misma experiencia que mencionaste, con un verbo más típico de entrevista.'
  }
  if (analysis.intent === 'introduction') {
    return 'Tu presentación, lista para decirla de un tirón.'
  }
  if (analysis.intent === 'agreement') {
    return 'Un «yes» suelto se entiende mejor si dices qué estás aceptando.'
  }
  return 'Una versión más natural de lo que acabas de decir.'
}

function buildNaturalnessSuggestion(
  analysis: PracticeUtteranceAnalysis,
  rewrite: string,
): CommunicationSuggestion {
  return {
    type: 'naturalidad',
    text: naturalnessCoach(analysis, rewrite),
    youSaidEn: analysis.original,
    tryThisEn: sameSpokenLine(analysis.original, rewrite) ? null : rewrite,
  }
}

function buildFluencySuggestion(
  analysis: PracticeUtteranceAnalysis,
  rewrite: string,
): CommunicationSuggestion | null {
  const expansion = expandForFluency(analysis)
  if (!expansion) {
    return null
  }
  if (sameSpokenLine(expansion, rewrite) && !analysis.isShort) {
    return null
  }
  if (analysis.isShort) {
    return {
      type: 'fluidez',
      text: `«${analysis.original}» se entiende, pero es demasiado breve. Completa la idea: «${expansion}».`,
      youSaidEn: analysis.original,
      tryThisEn: expansion,
    }
  }
  return {
    type: 'fluidez',
    text: `Puedes alargar esa misma idea con un detalle concreto: «${expansion}».`,
    youSaidEn: analysis.original,
    tryThisEn: expansion,
  }
}

function pushUnique(
  suggestions: CommunicationSuggestion[],
  next: CommunicationSuggestion | null,
): void {
  if (!next) {
    return
  }
  const already = suggestions.some(
    (item) =>
      item.type === next.type ||
      (item.tryThisEn && next.tryThisEn && sameSpokenLine(item.tryThisEn, next.tryThisEn)),
  )
  if (already && next.type !== 'vocabulario') {
    return
  }
  if (suggestions.some((item) => item.text === next.text)) {
    return
  }
  suggestions.push(next)
}

/**
 * Builds 1–3 coaching cards for the last user turn.
 * Always returns at least one tip tied to the spoken sentence.
 */
export function buildCommunicationSuggestions(
  input: CommunicationSuggestionsInput,
): readonly CommunicationSuggestion[] {
  const analysis = analyzePracticeUtterance({
    scenarioId: input.scenarioId,
    userUtteranceEn: input.userUtteranceEn,
    correctedUtteranceEn: input.correctedUtteranceEn,
    lastTutorLineEn: input.lastTutorLineEn,
  })
  const rewrite = rewriteAsNative(analysis)
  const suggestions: CommunicationSuggestion[] = []

  pushUnique(suggestions, buildVocabularySuggestion(analysis, rewrite))
  pushUnique(suggestions, buildNaturalnessSuggestion(analysis, rewrite))
  if (suggestions.length < MAXIMUM_SUGGESTIONS) {
    pushUnique(suggestions, buildFluencySuggestion(analysis, rewrite))
  }

  return suggestions.slice(0, MAXIMUM_SUGGESTIONS)
}
