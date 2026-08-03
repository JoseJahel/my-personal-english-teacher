/**
 * Pure computation of Word Error Rate (WER) between a reference transcript and
 * a hypothesis transcript (no model / browser APIs).
 */

/** Breakdown of a Word Error Rate computation. */
export interface WordErrorRateResult {
  readonly substitutions: number
  readonly deletions: number
  readonly insertions: number
  readonly referenceWordCount: number
  readonly wordErrorRate: number
}

/** Word-level edit chosen for a cell while backtracking the alignment matrix. */
type EditOperation = 'match' | 'substitution' | 'deletion' | 'insertion'

/**
 * Lowercases, strips punctuation (keeping unicode letters/digits/whitespace),
 * collapses runs of whitespace, and splits into non-empty words.
 */
function normalizeForWordErrorRate(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((word) => word.length > 0)
}

/**
 * Computes the Word Error Rate between a reference transcript and a hypothesis
 * transcript. Both strings are normalized (case/punctuation-insensitive) and
 * split into words, then aligned with a word-level Levenshtein edit distance.
 * The alignment is backtracked to count substitutions, deletions, and
 * insertions separately.
 *
 * When multiple minimal alignments exist, ties resolve substitution-first,
 * then deletion, then insertion — the total is always minimal but the S/D/I
 * split can differ from other equally-valid decompositions.
 *
 * wordErrorRate = (substitutions + deletions + insertions) / referenceWordCount
 *
 * An empty reference is a special case: WER is 0 if the hypothesis is also
 * empty, otherwise 1 (every hypothesis word is an insertion).
 */
export function computeWordErrorRate(reference: string, hypothesis: string): WordErrorRateResult {
  const referenceWords = normalizeForWordErrorRate(reference)
  const hypothesisWords = normalizeForWordErrorRate(hypothesis)
  const referenceWordCount = referenceWords.length

  if (referenceWordCount === 0) {
    const insertions = hypothesisWords.length
    return {
      substitutions: 0,
      deletions: 0,
      insertions,
      referenceWordCount: 0,
      wordErrorRate: insertions === 0 ? 0 : 1,
    }
  }

  const rows = referenceWordCount + 1
  const columns = hypothesisWords.length + 1

  // distance[i][j] = edit distance between referenceWords[0..i) and hypothesisWords[0..j)
  const distance: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(columns).fill(0),
  )
  const operation: EditOperation[][] = Array.from({ length: rows }, () =>
    new Array<EditOperation>(columns).fill('match'),
  )

  for (let i = 0; i < rows; i += 1) {
    distance[i][0] = i
    operation[i][0] = 'deletion'
  }
  for (let j = 0; j < columns; j += 1) {
    distance[0][j] = j
    operation[0][j] = 'insertion'
  }
  operation[0][0] = 'match'

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      if (referenceWords[i - 1] === hypothesisWords[j - 1]) {
        distance[i][j] = distance[i - 1][j - 1]
        operation[i][j] = 'match'
        continue
      }

      const substitutionCost = distance[i - 1][j - 1] + 1
      const deletionCost = distance[i - 1][j] + 1
      const insertionCost = distance[i][j - 1] + 1
      const minCost = Math.min(substitutionCost, deletionCost, insertionCost)

      distance[i][j] = minCost
      if (minCost === substitutionCost) {
        operation[i][j] = 'substitution'
      } else if (minCost === deletionCost) {
        operation[i][j] = 'deletion'
      } else {
        operation[i][j] = 'insertion'
      }
    }
  }

  let substitutions = 0
  let deletions = 0
  let insertions = 0

  let i = referenceWordCount
  let j = hypothesisWords.length
  while (i > 0 || j > 0) {
    const step = operation[i][j]
    if (step === 'match') {
      i -= 1
      j -= 1
    } else if (step === 'substitution') {
      substitutions += 1
      i -= 1
      j -= 1
    } else if (step === 'deletion') {
      deletions += 1
      i -= 1
    } else {
      insertions += 1
      j -= 1
    }
  }

  return {
    substitutions,
    deletions,
    insertions,
    referenceWordCount,
    wordErrorRate: (substitutions + deletions + insertions) / referenceWordCount,
  }
}
