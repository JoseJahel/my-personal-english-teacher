/**
 * Calibration for the exponential distance to score mapping used by
 * convertDtwDistanceToPronunciationScore (see dynamic-time-warping.ts):
 *
 *   score = 100 * exp(-ln(2) * distance / distanceAtHalfScore)
 *
 * Given labeled pairs of (normalized DTW distance, human-rated score in
 * [0, 100]), this recovers the distanceAtHalfScore that best fits the
 * exponential curve to the labels, via least squares on the linearized
 * form ln(score / 100) = -(ln 2 / distanceAtHalfScore) * distance.
 *
 * Pure domain: no I/O. Feed it distances computed by
 * scorePronunciationFromMonoPcm (.mfccNormalizedDistance or
 * .pitchNormalizedDistance) paired with human ratings collected offline
 * (e.g. from a small panel scoring recorded student/reference pairs 0-100).
 */

export interface CalibrationSample {
  /** Normalized DTW distance for this pair (e.g. mfccNormalizedDistance). */
  readonly normalizedDistance: number
  /** Human-rated pronunciation quality for the same pair, in [0, 100]. */
  readonly humanScore0to100: number
}

export interface CalibrationResult {
  /** Fitted distanceAtHalfScore to pass into convertDtwDistanceToPronunciationScore. */
  readonly distanceAtHalfScore: number
  /** Number of samples actually used (after filtering unusable ones). */
  readonly sampleCount: number
  /** Root-mean-square error between fitted scores and human labels, in score points. */
  readonly rootMeanSquareErrorInScorePoints: number
}

const MINIMUM_USABLE_SAMPLES = 3
const MINIMUM_USABLE_SCORE = 1 // avoid ln(0) blow-up; treat 0 as "unusable label"
const MAXIMUM_USABLE_SCORE = 100
// Pearson correlation between distance and score must be at least this
// negative before we trust an inverse relationship exists at all. Needed
// because the origin-constrained log-linear slope is almost always
// non-positive by construction (distance > 0, ln(score/100) <= 0), so slope
// sign alone can't detect data that trends the wrong way.
const MAXIMUM_ACCEPTABLE_CORRELATION = -0.3

/**
 * Fits distanceAtHalfScore from labeled (distance, human score) pairs.
 * Returns null when there isn't enough usable data to fit reliably, or when
 * the data doesn't show a clear inverse relationship (higher distance to
 * lower score).
 */
export function fitDistanceAtHalfScore(
  samples: readonly CalibrationSample[],
): CalibrationResult | null {
  const usable = samples.filter(
    (sample) =>
      Number.isFinite(sample.normalizedDistance) &&
      sample.normalizedDistance > 0 &&
      Number.isFinite(sample.humanScore0to100) &&
      sample.humanScore0to100 >= MINIMUM_USABLE_SCORE &&
      sample.humanScore0to100 <= MAXIMUM_USABLE_SCORE,
  )
  if (usable.length < MINIMUM_USABLE_SAMPLES) {
    return null
  }

  if (computePearsonCorrelation(usable) > MAXIMUM_ACCEPTABLE_CORRELATION) {
    return null
  }

  // Linearized model: y = slope * x, where
  //   x = normalizedDistance, y = ln(humanScore0to100 / 100)
  //   slope = -ln(2) / distanceAtHalfScore
  // Least squares through the origin: slope = sum(x*y) / sum(x^2)
  let sumXY = 0
  let sumXX = 0
  for (const sample of usable) {
    const x = sample.normalizedDistance
    const y = Math.log(sample.humanScore0to100 / 100)
    sumXY += x * y
    sumXX += x * x
  }
  if (sumXX === 0) {
    return null
  }
  const slope = sumXY / sumXX
  if (slope >= 0) {
    return null
  }
  const distanceAtHalfScore = -Math.LN2 / slope

  const rootMeanSquareErrorInScorePoints = computeRootMeanSquareError(
    usable,
    distanceAtHalfScore,
  )

  return {
    distanceAtHalfScore,
    sampleCount: usable.length,
    rootMeanSquareErrorInScorePoints,
  }
}

function computePearsonCorrelation(samples: readonly CalibrationSample[]): number {
  const n = samples.length
  let sumX = 0
  let sumY = 0
  for (const sample of samples) {
    sumX += sample.normalizedDistance
    sumY += sample.humanScore0to100
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let numerator = 0
  let sumSquaredDeviationX = 0
  let sumSquaredDeviationY = 0
  for (const sample of samples) {
    const deviationX = sample.normalizedDistance - meanX
    const deviationY = sample.humanScore0to100 - meanY
    numerator += deviationX * deviationY
    sumSquaredDeviationX += deviationX * deviationX
    sumSquaredDeviationY += deviationY * deviationY
  }
  const denominator = Math.sqrt(sumSquaredDeviationX * sumSquaredDeviationY)
  return denominator === 0 ? 0 : numerator / denominator
}

function computeRootMeanSquareError(
  samples: readonly CalibrationSample[],
  distanceAtHalfScore: number,
): number {
  let sumSquaredError = 0
  for (const sample of samples) {
    const predicted =
      100 * Math.exp((-Math.LN2 * sample.normalizedDistance) / distanceAtHalfScore)
    const error = predicted - sample.humanScore0to100
    sumSquaredError += error * error
  }
  return Math.sqrt(sumSquaredError / samples.length)
}
