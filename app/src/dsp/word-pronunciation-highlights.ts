/**
 * Map DTW local costs along the user MFCC timeline onto English words.
 * Pure domain: no browser APIs. Approximate force-alignment by character weight.
 */

import {
  computeFeatureVectorEuclideanDistance,
  convertDtwDistanceToPronunciationScore,
  type DtwPathStep,
} from './dynamic-time-warping'

export type WordHighlightBand = 'good' | 'medium' | 'poor'

export interface WordPronunciationHighlight {
  readonly word: string
  /** Higher = closer to the reference on that word's time slice. */
  readonly score0to100: number
  readonly band: WordHighlightBand
  readonly meanLocalDistance: number
}

export interface WordHighlightOptions {
  readonly distanceAtHalfScore?: number
  readonly goodScoreThreshold?: number
  readonly mediumScoreThreshold?: number
}

/** Split English practice text into display words (keeps punctuation attached). */
export function tokenizeEnglishWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

/**
 * Mean Euclidean local cost for each query (user) frame along a DTW path.
 * Path steps that revisit a query index are averaged.
 */
export function computeMeanLocalCostPerQueryFrame(
  queryFrames: readonly ArrayLike<number>[],
  referenceFrames: readonly ArrayLike<number>[],
  path: readonly DtwPathStep[],
): Float32Array {
  const sums = new Float32Array(queryFrames.length)
  const counts = new Uint32Array(queryFrames.length)

  for (const step of path) {
    const queryIndex = step.queryIndex
    const referenceIndex = step.referenceIndex
    if (
      queryIndex < 0 ||
      queryIndex >= queryFrames.length ||
      referenceIndex < 0 ||
      referenceIndex >= referenceFrames.length
    ) {
      continue
    }
    const localCost = computeFeatureVectorEuclideanDistance(
      queryFrames[queryIndex]!,
      referenceFrames[referenceIndex]!,
    )
    sums[queryIndex] = (sums[queryIndex] ?? 0) + localCost
    counts[queryIndex] = (counts[queryIndex] ?? 0) + 1
  }

  const means = new Float32Array(queryFrames.length)
  for (let index = 0; index < queryFrames.length; index += 1) {
    const count = counts[index] ?? 0
    means[index] = count > 0 ? (sums[index] ?? 0) / count : 0
  }
  return means
}

/**
 * Assign each word a score from the mean DTW cost of its proportional frame slice.
 * Longer words (more letters) get a wider slice of the user timeline.
 */
export function buildWordPronunciationHighlights(
  words: readonly string[],
  meanLocalCostPerQueryFrame: ArrayLike<number>,
  options?: WordHighlightOptions,
): WordPronunciationHighlight[] {
  if (words.length === 0) {
    return []
  }

  const frameCount = meanLocalCostPerQueryFrame.length
  if (frameCount === 0) {
    return words.map((word) => ({
      word,
      score0to100: 0,
      band: 'poor' as const,
      meanLocalDistance: Number.POSITIVE_INFINITY,
    }))
  }

  const distanceAtHalfScore = options?.distanceAtHalfScore ?? 18
  const goodScoreThreshold = options?.goodScoreThreshold ?? 70
  const mediumScoreThreshold = options?.mediumScoreThreshold ?? 45

  const letterWeights = words.map((word) => Math.max(1, countWordLetters(word)))
  const totalWeight = letterWeights.reduce((sum, weight) => sum + weight, 0)

  const highlights: WordPronunciationHighlight[] = []
  let frameCursor = 0

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex]!
    const weight = letterWeights[wordIndex]!
    const isLast = wordIndex === words.length - 1
    const remainingFrames = frameCount - frameCursor
    const remainingWords = words.length - wordIndex
    let frameSpan = isLast
      ? remainingFrames
      : Math.max(1, Math.round((weight / totalWeight) * frameCount))

    // Keep enough frames for later words.
    const maxSpan = remainingFrames - (remainingWords - 1)
    frameSpan = Math.min(frameSpan, Math.max(1, maxSpan))

    const frameStart = frameCursor
    const frameEnd = Math.min(frameCount, frameStart + frameSpan)
    frameCursor = frameEnd

    let costSum = 0
    let costCount = 0
    for (let frameIndex = frameStart; frameIndex < frameEnd; frameIndex += 1) {
      costSum += meanLocalCostPerQueryFrame[frameIndex] ?? 0
      costCount += 1
    }
    const meanLocalDistance = costCount > 0 ? costSum / costCount : 0
    const score0to100 = convertDtwDistanceToPronunciationScore(meanLocalDistance, {
      distanceAtHalfScore,
    })
    const band = classifyWordHighlightBand(score0to100, goodScoreThreshold, mediumScoreThreshold)

    highlights.push({
      word,
      score0to100: roundScore(score0to100),
      band,
      meanLocalDistance,
    })
  }

  return highlights
}

export function classifyWordHighlightBand(
  score0to100: number,
  goodScoreThreshold = 70,
  mediumScoreThreshold = 45,
): WordHighlightBand {
  if (score0to100 >= goodScoreThreshold) {
    return 'good'
  }
  if (score0to100 >= mediumScoreThreshold) {
    return 'medium'
  }
  return 'poor'
}

function countWordLetters(word: string): number {
  const letters = word.match(/[a-zA-Z]/g)
  return letters?.length ?? 0
}

function roundScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10
}
