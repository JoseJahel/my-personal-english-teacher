/**
 * Answers a learner's question about the open lesson using the lesson itself.
 *
 * Pure domain, same rule as the rest of `study/`: no React, no DOM, no `ia/`.
 * Deliberately deterministic rather than model-backed: SmolLM2 is a 360M model
 * capped at 36 new tokens and already gated behind `isPlausibleTutorReply`
 * (see `ia/conversation-suggestions.ts`), so the team's existing decision is to
 * keep curated, instant content as the primary path and treat the model as an
 * optional extra. An answer built from the lesson is instant, works before any
 * model finishes downloading, and can never invent vocabulary the course does
 * not teach.
 *
 * Returns structured data, never formatted prose: the Spanish wording lives in
 * the UI text layer, so switching the answer language later touches only that.
 */
import {
  extractModelPhrases,
  extractVocabPairs,
  matchKeysFromEnglish,
  type ExtractedVocabPair,
} from './extract-practice-items'

export interface LessonQuestionSource {
  readonly lessonId: string
  readonly bodyMarkdown: string
  readonly tema?: string
  readonly objetivo?: string
}

export interface LessonVocabularyMatch {
  readonly englishTerm: string
  readonly spanishTerm: string
  /** A model phrase from this same lesson that uses the term, when one exists. */
  readonly examplePhraseEn: string | null
}

export interface LessonVocabularyAnswer {
  readonly kind: 'vocabulary'
  readonly matches: readonly LessonVocabularyMatch[]
}

export interface LessonPhraseAnswer {
  readonly kind: 'phrase'
  readonly phrasesEn: readonly string[]
}

export interface LessonOverviewAnswer {
  readonly kind: 'overview'
  readonly objetivo: string | null
  readonly examplePhrasesEn: readonly string[]
}

export interface LessonUnknownAnswer {
  readonly kind: 'unknown'
  /** Spanish terms this lesson does cover, so the UI can suggest what to ask. */
  readonly suggestedTermsEs: readonly string[]
}

export type LessonAnswer =
  | LessonVocabularyAnswer
  | LessonPhraseAnswer
  | LessonOverviewAnswer
  | LessonUnknownAnswer

export const MAXIMUM_VOCABULARY_MATCHES = 3
export const MAXIMUM_PHRASE_MATCHES = 3
export const MAXIMUM_SUGGESTED_TERMS = 5

/** Whole-term hit outranks a single-word hit regardless of word length. */
const WHOLE_TERM_SCORE_BONUS = 10

const OVERVIEW_QUESTION_PATTERNS: readonly RegExp[] = [
  /\bde que (trata|va|es)\b/,
  /\bsobre que\b/,
  /\bque (tema|resumen|objetivo)\b/,
  /\bque (aprendo|estudio|veo|practico)\b/,
  /\bresumen\b/,
  /\bobjetivo\b/,
  /\bwhat is this lesson about\b/,
]

/**
 * Filler words carry no lookup value. Written without accents because every
 * comparison runs on accent-stripped text (see `normalizeForMatching`).
 */
const QUESTION_STOPWORDS = new Set([
  'a', 'al', 'an', 'are', 'ayuda', 'como', 'con', 'cual', 'cuales', 'cuando',
  'de', 'decir', 'del', 'dice', 'digo', 'does', 'donde', 'do', 'el', 'en',
  'ensename', 'esa', 'ese', 'eso', 'esta', 'este', 'esto', 'estar', 'favor',
  'frase', 'hay', 'how', 'i', 'in', 'ingles', 'is', 'it', 'la', 'las',
  'leccion', 'lo', 'los', 'me', 'mean', 'means', 'mi', 'my', 'of', 'on', 'o',
  'palabra', 'para', 'please', 'phrase', 'por', 'porque', 'profe', 'profesor',
  'puedo', 'que', 'quien', 'quiere', 'say', 'says', 'se', 'ser', 'significa',
  'son', 'su', 'tell', 'that', 'the', 'this', 'to', 'traducir', 'traduccion',
  'traduce', 'tu', 'un', 'una', 'unas', 'unos', 'what', 'word', 'y', 'you',
])

/**
 * Picks the most useful answer the lesson can give: a vocabulary lookup when
 * the question names a term the lesson teaches, otherwise model phrases that
 * mention it, otherwise an overview or an honest "not in this lesson".
 */
export function answerLessonQuestion(
  question: string,
  lesson: LessonQuestionSource,
): LessonAnswer {
  const normalizedQuestion = normalizeForMatching(question)
  const phrases = extractModelPhrases(lesson.bodyMarkdown)
  const pairs =
    lesson.tema === undefined
      ? []
      : extractVocabPairs(lesson.bodyMarkdown, lesson.tema, lesson.lessonId)

  if (normalizedQuestion.length === 0) {
    return unknownAnswer(pairs)
  }
  if (OVERVIEW_QUESTION_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    return {
      kind: 'overview',
      objetivo: lesson.objetivo?.trim() ? lesson.objetivo.trim() : null,
      examplePhrasesEn: phrases.slice(0, MAXIMUM_PHRASE_MATCHES),
    }
  }

  const tokens = contentTokens(normalizedQuestion)
  const matches = matchVocabulary(normalizedQuestion, tokens, pairs, phrases)
  if (matches.length > 0) {
    return { kind: 'vocabulary', matches }
  }
  const matchedPhrases = matchPhrases(tokens, phrases)
  if (matchedPhrases.length > 0) {
    return { kind: 'phrase', phrasesEn: matchedPhrases }
  }
  return unknownAnswer(pairs)
}

/** Accent- and punctuation-insensitive so "vacaciones" matches "vacaciónes". */
function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentTokens(normalizedText: string): readonly string[] {
  if (normalizedText.length === 0) {
    return []
  }
  return normalizedText
    .split(' ')
    .filter((token) => token.length >= 2 && !QUESTION_STOPWORDS.has(token))
}

function matchVocabulary(
  normalizedQuestion: string,
  tokens: readonly string[],
  pairs: readonly ExtractedVocabPair[],
  phrases: readonly string[],
): readonly LessonVocabularyMatch[] {
  const scored = pairs
    .map((pair, index) => ({ index, score: scoreVocabPair(normalizedQuestion, tokens, pair) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  const alreadyMatched = new Set<string>()
  const matches: LessonVocabularyMatch[] = []
  for (const entry of scored) {
    const pair = pairs[entry.index]
    if (!pair) {
      continue
    }
    const key = pair.en.toLowerCase()
    if (alreadyMatched.has(key)) {
      continue
    }
    alreadyMatched.add(key)
    matches.push({
      englishTerm: pair.en,
      spanishTerm: pair.es,
      examplePhraseEn: findExamplePhrase(pair, phrases),
    })
    if (matches.length >= MAXIMUM_VOCABULARY_MATCHES) {
      break
    }
  }
  return matches
}

/** Both sides are searched so the learner can ask in Spanish or in English. */
function scoreVocabPair(
  normalizedQuestion: string,
  tokens: readonly string[],
  pair: ExtractedVocabPair,
): number {
  let best = 0
  for (const side of [pair.en, pair.es]) {
    for (const variant of side.split(/\s*\/\s*/)) {
      const normalized = normalizeForMatching(variant)
      if (normalized.length < 2) {
        continue
      }
      if (containsWholeWord(normalizedQuestion, normalized)) {
        best = Math.max(best, normalized.length + WHOLE_TERM_SCORE_BONUS)
        continue
      }
      for (const word of normalized.split(' ')) {
        if (word.length >= 3 && tokens.includes(word)) {
          best = Math.max(best, word.length)
        }
      }
    }
  }
  return best
}

function findExamplePhrase(
  pair: ExtractedVocabPair,
  phrases: readonly string[],
): string | null {
  for (const key of matchKeysFromEnglish(pair.en)) {
    const normalizedKey = normalizeForMatching(key)
    if (normalizedKey.length < 2) {
      continue
    }
    for (const phrase of phrases) {
      if (containsWholeWord(normalizeForMatching(phrase), normalizedKey)) {
        return phrase
      }
    }
  }
  return null
}

function matchPhrases(
  tokens: readonly string[],
  phrases: readonly string[],
): readonly string[] {
  const matched: string[] = []
  for (const phrase of phrases) {
    const normalized = normalizeForMatching(phrase)
    const hit = tokens.some(
      (token) => token.length >= 3 && containsWholeWord(normalized, token),
    )
    if (hit) {
      matched.push(phrase)
    }
    if (matched.length >= MAXIMUM_PHRASE_MATCHES) {
      break
    }
  }
  return matched
}

function unknownAnswer(pairs: readonly ExtractedVocabPair[]): LessonUnknownAnswer {
  return {
    kind: 'unknown',
    suggestedTermsEs: pairs.slice(0, MAXIMUM_SUGGESTED_TERMS).map((pair) => pair.es),
  }
}

function containsWholeWord(haystack: string, needle: string): boolean {
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`).test(haystack)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
