/**
 * Pure word-level diff between an ASR transcript and its T5-corrected text
 * (no model / browser APIs). Used to render red/green/amber word highlights
 * instead of a flat "before/after" block.
 */

export type GrammarDiffTokenType =
  | 'unchanged'
  | 'added'
  | 'removed'
  | 'substituted-old'
  | 'substituted-new'

export interface GrammarDiffToken {
  readonly type: GrammarDiffTokenType
  readonly text: string
}

type WordDiffOperation = 'equal' | 'delete' | 'insert'

/** Lowercases and strips surrounding punctuation so "school." matches "school". */
function normalizeWordForDiff(word: string): string {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function splitIntoWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
}

/**
 * Word-level LCS alignment (classic O(n*m) dynamic programming, same shape
 * as the Levenshtein table in `word-error-rate.ts`). Returns the sequence of
 * equal/delete/insert operations that turns `originalWords` into
 * `correctedWords` while keeping the longest common (normalized) subsequence.
 */
function computeWordDiffOperations(
  originalWords: readonly string[],
  correctedWords: readonly string[],
): WordDiffOperation[] {
  const originalNormalized = originalWords.map(normalizeWordForDiff)
  const correctedNormalized = correctedWords.map(normalizeWordForDiff)
  const rows = originalWords.length + 1
  const columns = correctedWords.length + 1

  // lcsLength[i][j] = length of the LCS of originalWords[i..) and correctedWords[j..)
  const lcsLength: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(columns).fill(0),
  )

  for (let i = rows - 2; i >= 0; i -= 1) {
    for (let j = columns - 2; j >= 0; j -= 1) {
      if (originalNormalized[i] === correctedNormalized[j]) {
        lcsLength[i][j] = lcsLength[i + 1][j + 1] + 1
      } else {
        lcsLength[i][j] = Math.max(lcsLength[i + 1][j], lcsLength[i][j + 1])
      }
    }
  }

  const operations: WordDiffOperation[] = []
  let i = 0
  let j = 0
  while (i < originalWords.length && j < correctedWords.length) {
    if (originalNormalized[i] === correctedNormalized[j]) {
      operations.push('equal')
      i += 1
      j += 1
    } else if (lcsLength[i + 1][j] >= lcsLength[i][j + 1]) {
      operations.push('delete')
      i += 1
    } else {
      operations.push('insert')
      j += 1
    }
  }
  while (i < originalWords.length) {
    operations.push('delete')
    i += 1
  }
  while (j < correctedWords.length) {
    operations.push('insert')
    j += 1
  }

  return operations
}

/**
 * Word-level diff between `originalText` (ASR transcript) and `correctedText`
 * (T5 grammar correction). Word matching ignores case and surrounding
 * punctuation (same normalization spirit as `grammarCorrectionMadeNoChanges`),
 * but every rendered token keeps its original text.
 *
 * A contiguous run of deleted+inserted words is paired index-by-index into
 * substituted-old/substituted-new tokens (amber in the UI); words left over
 * after pairing stay 'removed' (red) or 'added' (green).
 */
export function diffEnglishWords(originalText: string, correctedText: string): GrammarDiffToken[] {
  const originalWords = splitIntoWords(originalText)
  const correctedWords = splitIntoWords(correctedText)

  if (originalWords.length === 0 && correctedWords.length === 0) {
    return []
  }

  const operations = computeWordDiffOperations(originalWords, correctedWords)

  const tokens: GrammarDiffToken[] = []
  let originalIndex = 0
  let correctedIndex = 0
  let operationIndex = 0

  while (operationIndex < operations.length) {
    const operation = operations[operationIndex]

    if (operation === 'equal') {
      tokens.push({ type: 'unchanged', text: correctedWords[correctedIndex] })
      originalIndex += 1
      correctedIndex += 1
      operationIndex += 1
      continue
    }

    // Collect a contiguous delete/insert run and pair words index-by-index
    // into substitutions; anything left over is a pure removal or addition.
    const deletedWords: string[] = []
    const insertedWords: string[] = []
    while (operationIndex < operations.length && operations[operationIndex] !== 'equal') {
      if (operations[operationIndex] === 'delete') {
        deletedWords.push(originalWords[originalIndex])
        originalIndex += 1
      } else {
        insertedWords.push(correctedWords[correctedIndex])
        correctedIndex += 1
      }
      operationIndex += 1
    }

    const pairedCount = Math.min(deletedWords.length, insertedWords.length)
    for (let pairIndex = 0; pairIndex < pairedCount; pairIndex += 1) {
      tokens.push({ type: 'substituted-old', text: deletedWords[pairIndex] })
      tokens.push({ type: 'substituted-new', text: insertedWords[pairIndex] })
    }
    for (let index = pairedCount; index < deletedWords.length; index += 1) {
      tokens.push({ type: 'removed', text: deletedWords[index] })
    }
    for (let index = pairedCount; index < insertedWords.length; index += 1) {
      tokens.push({ type: 'added', text: insertedWords[index] })
    }
  }

  return tokens
}
