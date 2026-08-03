/**
 * Dynamic Time Warping (DTW) for pronunciation feature sequences.
 * Pure domain: aligns two series of vectors (e.g. MFCC frames) with Euclidean
 * local cost and returns path + distances. No browser APIs.
 *
 * Design note (README): compare after speaker-side normalization (z-score /
 * relative pitch) so DTW measures pronunciation, not vocal identity.
 */

export interface DtwPathStep {
  readonly queryIndex: number
  readonly referenceIndex: number
}

export interface DynamicTimeWarpingResult {
  /** Sum of local Euclidean costs along the optimal path. */
  readonly totalDistance: number
  /** totalDistance / path length — comparable across utterances of different duration. */
  readonly normalizedDistance: number
  /** Optimal alignment (query index, reference index), chronological. */
  readonly path: readonly DtwPathStep[]
}

export interface DynamicTimeWarpingOptions {
  /**
   * Sakoe–Chiba band half-width in frames. When set, only |i−j| ≤ radius cells
   * are considered (plus a stretch factor for unequal lengths). Omit for full DTW.
   */
  readonly sakoeChibaRadiusInFrames?: number
}

/**
 * Euclidean distance between two feature vectors (shared local cost for DTW).
 * Uses the overlapping prefix if lengths differ.
 */
export function computeFeatureVectorEuclideanDistance(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): number {
  const length = Math.min(left.length, right.length)
  let sumOfSquares = 0
  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0)
    sumOfSquares += delta * delta
  }
  return Math.sqrt(sumOfSquares)
}

/**
 * Classic DTW between two sequences of multi-dimensional frames.
 * Step pattern: (i−1,j), (i,j−1), (i−1,j−1) — allows stretch/compress of either series.
 */
export function computeDynamicTimeWarping(
  queryFrames: readonly ArrayLike<number>[],
  referenceFrames: readonly ArrayLike<number>[],
  options?: DynamicTimeWarpingOptions,
): DynamicTimeWarpingResult {
  const queryLength = queryFrames.length
  const referenceLength = referenceFrames.length

  if (queryLength === 0 || referenceLength === 0) {
    return {
      totalDistance: Number.POSITIVE_INFINITY,
      normalizedDistance: Number.POSITIVE_INFINITY,
      path: [],
    }
  }

  const sakoeChibaRadiusInFrames = options?.sakoeChibaRadiusInFrames
  const costMatrix = createCostMatrix(queryLength, referenceLength)

  for (let queryIndex = 0; queryIndex < queryLength; queryIndex += 1) {
    for (let referenceIndex = 0; referenceIndex < referenceLength; referenceIndex += 1) {
      if (
        sakoeChibaRadiusInFrames !== undefined &&
        !isInsideSakoeChibaBand(
          queryIndex,
          referenceIndex,
          queryLength,
          referenceLength,
          sakoeChibaRadiusInFrames,
        )
      ) {
        costMatrix[queryIndex]![referenceIndex] = Number.POSITIVE_INFINITY
        continue
      }

      const localCost = computeFeatureVectorEuclideanDistance(
        queryFrames[queryIndex]!,
        referenceFrames[referenceIndex]!,
      )

      if (queryIndex === 0 && referenceIndex === 0) {
        costMatrix[0]![0] = localCost
        continue
      }

      const fromLeft =
        referenceIndex > 0
          ? (costMatrix[queryIndex]![referenceIndex - 1] ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY
      const fromBelow =
        queryIndex > 0
          ? (costMatrix[queryIndex - 1]![referenceIndex] ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY
      const fromDiagonal =
        queryIndex > 0 && referenceIndex > 0
          ? (costMatrix[queryIndex - 1]![referenceIndex - 1] ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY

      costMatrix[queryIndex]![referenceIndex] =
        localCost + Math.min(fromLeft, fromBelow, fromDiagonal)
    }
  }

  const totalDistance =
    costMatrix[queryLength - 1]![referenceLength - 1] ?? Number.POSITIVE_INFINITY
  const path = backtrackOptimalPath(costMatrix, queryLength, referenceLength)
  const pathLength = Math.max(1, path.length)
  const normalizedDistance = Number.isFinite(totalDistance)
    ? totalDistance / pathLength
    : Number.POSITIVE_INFINITY

  return {
    totalDistance,
    normalizedDistance,
    path,
  }
}

/**
 * Map a DTW normalized distance to a 0–100 pronunciation-style score.
 * Lower distance → higher score. Uses a soft exponential decay.
 *
 * `distanceAtHalfScore` is the normalized distance that maps to ~50.
 * Tune later against real user/reference pairs once TTS is wired.
 */
export function convertDtwDistanceToPronunciationScore(
  normalizedDistance: number,
  options?: { readonly distanceAtHalfScore?: number },
): number {
  if (!Number.isFinite(normalizedDistance) || normalizedDistance < 0) {
    return 0
  }
  if (normalizedDistance === 0) {
    return 100
  }

  const distanceAtHalfScore = options?.distanceAtHalfScore ?? 15
  // score = 100 * exp(-ln(2) * d / d_half)  → 50 when d = d_half
  const score = 100 * Math.exp((-Math.LN2 * normalizedDistance) / distanceAtHalfScore)
  return clampScore(score)
}

/**
 * Per-coefficient z-score over the utterance (speaker / recording level).
 * Leaves frames of length 0 untouched. Constant features → zeros.
 */
export function zScoreNormalizeFeatureSequence(
  frames: readonly ArrayLike<number>[],
): Float32Array[] {
  if (frames.length === 0) {
    return []
  }

  const dimension = frames[0]?.length ?? 0
  if (dimension === 0) {
    return frames.map(() => new Float32Array(0))
  }

  const means = new Float32Array(dimension)
  const standardDeviations = new Float32Array(dimension)

  for (const frame of frames) {
    for (let dimensionIndex = 0; dimensionIndex < dimension; dimensionIndex += 1) {
      means[dimensionIndex] =
        (means[dimensionIndex] ?? 0) + (frame[dimensionIndex] ?? 0)
    }
  }
  for (let dimensionIndex = 0; dimensionIndex < dimension; dimensionIndex += 1) {
    means[dimensionIndex] = (means[dimensionIndex] ?? 0) / frames.length
  }

  for (const frame of frames) {
    for (let dimensionIndex = 0; dimensionIndex < dimension; dimensionIndex += 1) {
      const delta = (frame[dimensionIndex] ?? 0) - (means[dimensionIndex] ?? 0)
      standardDeviations[dimensionIndex] =
        (standardDeviations[dimensionIndex] ?? 0) + delta * delta
    }
  }
  for (let dimensionIndex = 0; dimensionIndex < dimension; dimensionIndex += 1) {
    const variance = (standardDeviations[dimensionIndex] ?? 0) / frames.length
    standardDeviations[dimensionIndex] = Math.sqrt(variance)
  }

  return frames.map((frame) => {
    const normalized = new Float32Array(dimension)
    for (let dimensionIndex = 0; dimensionIndex < dimension; dimensionIndex += 1) {
      const deviation = standardDeviations[dimensionIndex] ?? 0
      if (deviation < 1e-12) {
        normalized[dimensionIndex] = 0
      } else {
        normalized[dimensionIndex] =
          ((frame[dimensionIndex] ?? 0) - (means[dimensionIndex] ?? 0)) / deviation
      }
    }
    return normalized
  })
}

/**
 * Relative pitch contour: subtract mean of finite voiced values, drop unvoiced as NaN-free zeros
 * only when converting for DTW via {@link pitchContourToFeatureFrames}.
 */
export function centerVoicedPitchContourInHertz(
  pitchContourInHertz: readonly (number | null)[],
): (number | null)[] {
  let sum = 0
  let count = 0
  for (const value of pitchContourInHertz) {
    if (value !== null && Number.isFinite(value)) {
      sum += value
      count += 1
    }
  }
  if (count === 0) {
    return pitchContourInHertz.map(() => null)
  }
  const mean = sum / count
  return pitchContourInHertz.map((value) =>
    value !== null && Number.isFinite(value) ? value - mean : null,
  )
}

/**
 * Pack a 1-D pitch series into 1-D feature frames for DTW.
 * Unvoiced (null) frames become a single zero so path length stays aligned with time.
 */
export function pitchContourToFeatureFrames(
  pitchContourInHertz: readonly (number | null)[],
): Float32Array[] {
  return pitchContourInHertz.map((value) => {
    const frame = new Float32Array(1)
    frame[0] = value !== null && Number.isFinite(value) ? value : 0
    return frame
  })
}

function createCostMatrix(queryLength: number, referenceLength: number): number[][] {
  const matrix: number[][] = new Array(queryLength)
  for (let queryIndex = 0; queryIndex < queryLength; queryIndex += 1) {
    matrix[queryIndex] = new Array(referenceLength).fill(Number.POSITIVE_INFINITY)
  }
  return matrix
}

/**
 * Band around the diagonal, scaled when series lengths differ so endpoints remain reachable.
 */
function isInsideSakoeChibaBand(
  queryIndex: number,
  referenceIndex: number,
  queryLength: number,
  referenceLength: number,
  radiusInFrames: number,
): boolean {
  if (radiusInFrames < 0) {
    return true
  }
  // Map query index onto reference axis so the band follows the main diagonal.
  const expectedReferenceIndex =
    queryLength === 1 ? 0 : (queryIndex * (referenceLength - 1)) / (queryLength - 1)
  return Math.abs(referenceIndex - expectedReferenceIndex) <= radiusInFrames + 1e-9
}

function backtrackOptimalPath(
  costMatrix: number[][],
  queryLength: number,
  referenceLength: number,
): DtwPathStep[] {
  let queryIndex = queryLength - 1
  let referenceIndex = referenceLength - 1
  const reversedPath: DtwPathStep[] = [{ queryIndex, referenceIndex }]

  while (queryIndex > 0 || referenceIndex > 0) {
    if (queryIndex === 0) {
      referenceIndex -= 1
    } else if (referenceIndex === 0) {
      queryIndex -= 1
    } else {
      const diagonal = costMatrix[queryIndex - 1]![referenceIndex - 1] ?? Number.POSITIVE_INFINITY
      const up = costMatrix[queryIndex - 1]![referenceIndex] ?? Number.POSITIVE_INFINITY
      const left = costMatrix[queryIndex]![referenceIndex - 1] ?? Number.POSITIVE_INFINITY
      const best = Math.min(diagonal, up, left)
      if (best === diagonal) {
        queryIndex -= 1
        referenceIndex -= 1
      } else if (best === up) {
        queryIndex -= 1
      } else {
        referenceIndex -= 1
      }
    }
    reversedPath.push({ queryIndex, referenceIndex })
  }

  reversedPath.reverse()
  return reversedPath
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0
  }
  if (score < 0) {
    return 0
  }
  if (score > 100) {
    return 100
  }
  return score
}
