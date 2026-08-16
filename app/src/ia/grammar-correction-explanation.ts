/**
 * Rule-based Spanish explanations for a grammar correction diff (issue #78).
 * Offline, deterministic — reuses the word-level diff from
 * `grammar-correction-diff.ts` (issue #69) instead of running a model, so it
 * never adds latency to the tutor's TTS pipeline (a completely separate,
 * unrelated code path — no shared queue, no async call here at all).
 *
 * Returns at most 2 short Spanish sentences, only when the diff contains a
 * real change (an all-"unchanged" or empty diff returns []). The explanatory
 * prose is always Spanish; the specific English words being discussed are
 * quoted verbatim, since that's the only way to say what changed.
 *
 * Documented rule set (checked per diff token, in this priority order, first
 * 2 matches win):
 * 1. Article added ("a" / "an" / "the").
 * 2. Third-person -s/-es agreement on a substituted word pair.
 * 3. Regular past tense -ed/-d on a substituted word pair.
 * 4. A removed word.
 * 5. Any other substituted word pair (generic — covers irregular verbs, etc).
 * 6. Any other added word (generic).
 */

import { diffEnglishWords, type GrammarDiffToken } from './grammar-correction-diff'

const MAXIMUM_EXPLANATIONS = 2

const ARTICLES = new Set(['a', 'an', 'the'])

function stripPunctuationForRuleMatching(word: string): string {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function explainAddedWord(word: string): string {
  const normalized = stripPunctuationForRuleMatching(word)
  if (ARTICLES.has(normalized)) {
    return `Se añadió el artículo "${word}".`
  }
  return `Se añadió la palabra "${word}".`
}

function explainRemovedWord(word: string): string {
  return `Se eliminó la palabra "${word}" por ser innecesaria.`
}

function explainSubstitutedPair(oldWord: string, newWord: string): string {
  const oldNormalized = stripPunctuationForRuleMatching(oldWord)
  const newNormalized = stripPunctuationForRuleMatching(newWord)

  if (newNormalized === `${oldNormalized}s` || newNormalized === `${oldNormalized}es`) {
    return `Concordancia de tercera persona: "${oldWord}" se corrigió a "${newWord}".`
  }
  if (newNormalized === `${oldNormalized}ed` || newNormalized === `${oldNormalized}d`) {
    return `Se corrigió el tiempo verbal: "${oldWord}" se corrigió a "${newWord}".`
  }
  return `Se ajustó la gramática: "${oldWord}" se cambió por "${newWord}".`
}

/**
 * Same rules as `explainGrammarCorrectionInSpanish`, for callers that already
 * have the diff tokens (e.g. a component that also renders the colored diff).
 */
export function explainDiffTokensInSpanish(tokens: readonly GrammarDiffToken[]): string[] {
  const explanations: string[] = []
  let index = 0

  while (index < tokens.length && explanations.length < MAXIMUM_EXPLANATIONS) {
    const token = tokens[index]
    const nextToken = tokens[index + 1]

    if (token.type === 'substituted-old' && nextToken?.type === 'substituted-new') {
      explanations.push(explainSubstitutedPair(token.text, nextToken.text))
      index += 2
      continue
    }
    if (token.type === 'added') {
      explanations.push(explainAddedWord(token.text))
      index += 1
      continue
    }
    if (token.type === 'removed') {
      explanations.push(explainRemovedWord(token.text))
      index += 1
      continue
    }
    index += 1
  }

  return explanations
}

/**
 * Builds up to 2 short Spanish sentences explaining a grammar correction,
 * from the word-level diff between `originalText` and `correctedText`.
 * Empty array when there is no real change.
 */
export function explainGrammarCorrectionInSpanish(
  originalText: string,
  correctedText: string,
): string[] {
  return explainDiffTokensInSpanish(diffEnglishWords(originalText, correctedText))
}
