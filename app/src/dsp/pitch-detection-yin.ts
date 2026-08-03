/**
 * YIN pitch detection (de Cheveigné & Kawahara, 2002).
 * Pure domain: mono PCM in → fundamental frequency estimates out.
 * No browser APIs. Foundation for pronunciation pitch tracking (Avance 2).
 */

/** Default absolute threshold on the cumulative mean normalized difference. */
export const DEFAULT_YIN_ABSOLUTE_THRESHOLD = 0.1

/** Lower bound of the search range (typical adult speech floor). */
export const DEFAULT_YIN_MINIMUM_FREQUENCY_HZ = 70

/** Upper bound of the search range (covers most speaking F0; cuts high noise). */
export const DEFAULT_YIN_MAXIMUM_FREQUENCY_HZ = 400

/** Default analysis frame length in seconds (~25–40 ms is common for pitch). */
export const DEFAULT_YIN_FRAME_DURATION_SECONDS = 0.04

/** Default hop between frames in seconds (~10 ms for a smooth contour). */
export const DEFAULT_YIN_HOP_DURATION_SECONDS = 0.01

export interface YinPitchEstimate {
  /** Fundamental frequency in hertz, or null when unvoiced / no reliable period. */
  readonly frequencyInHertz: number | null
  /**
   * Value of the cumulative mean normalized difference at the chosen lag.
   * Lower is more periodic (0 = perfect period match within the model).
   */
  readonly probability: number
  /** Sample lag (period in samples) after parabolic refinement, if voiced. */
  readonly periodInSamples: number | null
}

export interface YinPitchDetectionOptions {
  readonly absoluteThreshold?: number
  readonly minimumFrequencyInHertz?: number
  readonly maximumFrequencyInHertz?: number
}

export interface YinPitchContourOptions extends YinPitchDetectionOptions {
  readonly frameDurationSeconds?: number
  readonly hopDurationSeconds?: number
}

export interface YinPitchContourFrame {
  readonly frameIndex: number
  readonly timeInSeconds: number
  readonly frequencyInHertz: number | null
  readonly probability: number
}

/**
 * Estimate F0 of a mono PCM frame with YIN.
 * Returns null frequency when the frame is silent, too short, or unvoiced.
 */
export function estimatePitchWithYin(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: YinPitchDetectionOptions,
): YinPitchEstimate {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return { frequencyInHertz: null, probability: 1, periodInSamples: null }
  }

  if (computePeakAbsolute(samples) < 1e-6) {
    return { frequencyInHertz: null, probability: 1, periodInSamples: null }
  }

  const absoluteThreshold = options?.absoluteThreshold ?? DEFAULT_YIN_ABSOLUTE_THRESHOLD
  const minimumFrequencyInHertz =
    options?.minimumFrequencyInHertz ?? DEFAULT_YIN_MINIMUM_FREQUENCY_HZ
  const maximumFrequencyInHertz =
    options?.maximumFrequencyInHertz ?? DEFAULT_YIN_MAXIMUM_FREQUENCY_HZ

  if (
    minimumFrequencyInHertz <= 0 ||
    maximumFrequencyInHertz <= minimumFrequencyInHertz ||
    maximumFrequencyInHertz > sampleRateInHertz / 2
  ) {
    return { frequencyInHertz: null, probability: 1, periodInSamples: null }
  }

  // Period τ in samples: f = sr / τ  ⇒  τ = sr / f
  const maximumPeriodInSamples = Math.floor(sampleRateInHertz / minimumFrequencyInHertz)
  const minimumPeriodInSamples = Math.max(
    2,
    Math.floor(sampleRateInHertz / maximumFrequencyInHertz),
  )

  // Need at least one full period of headroom for the difference function.
  if (samples.length <= maximumPeriodInSamples + 1) {
    return { frequencyInHertz: null, probability: 1, periodInSamples: null }
  }

  const differenceFunction = computeYinDifferenceFunction(samples, maximumPeriodInSamples)
  const cumulativeMeanNormalizedDifference =
    computeCumulativeMeanNormalizedDifference(differenceFunction)

  const tauEstimate = findAbsoluteThresholdCrossing(
    cumulativeMeanNormalizedDifference,
    minimumPeriodInSamples,
    maximumPeriodInSamples,
    absoluteThreshold,
  )

  if (tauEstimate === null) {
    const bestTau = findGlobalMinimumLag(
      cumulativeMeanNormalizedDifference,
      minimumPeriodInSamples,
      maximumPeriodInSamples,
    )
    const probability =
      bestTau === null ? 1 : (cumulativeMeanNormalizedDifference[bestTau] ?? 1)
    return { frequencyInHertz: null, probability, periodInSamples: null }
  }

  const refinedPeriodInSamples = refinePeriodWithParabolicInterpolation(
    cumulativeMeanNormalizedDifference,
    tauEstimate,
  )
  if (refinedPeriodInSamples <= 0) {
    return { frequencyInHertz: null, probability: 1, periodInSamples: null }
  }

  const frequencyInHertz = sampleRateInHertz / refinedPeriodInSamples
  const probability = cumulativeMeanNormalizedDifference[tauEstimate] ?? 1

  if (
    frequencyInHertz < minimumFrequencyInHertz ||
    frequencyInHertz > maximumFrequencyInHertz
  ) {
    return {
      frequencyInHertz: null,
      probability,
      periodInSamples: refinedPeriodInSamples,
    }
  }

  return {
    frequencyInHertz,
    probability,
    periodInSamples: refinedPeriodInSamples,
  }
}

/**
 * Frame-wise YIN contour over a mono utterance (or live buffer).
 * Unvoiced frames get `frequencyInHertz: null`.
 */
export function extractPitchContourWithYin(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: YinPitchContourOptions,
): YinPitchContourFrame[] {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return []
  }

  const frameDurationSeconds =
    options?.frameDurationSeconds ?? DEFAULT_YIN_FRAME_DURATION_SECONDS
  const hopDurationSeconds = options?.hopDurationSeconds ?? DEFAULT_YIN_HOP_DURATION_SECONDS
  const frameLengthInSamples = Math.max(1, Math.floor(frameDurationSeconds * sampleRateInHertz))
  const hopLengthInSamples = Math.max(1, Math.floor(hopDurationSeconds * sampleRateInHertz))

  if (samples.length < frameLengthInSamples) {
    const single = estimatePitchWithYin(samples, sampleRateInHertz, options)
    return [
      {
        frameIndex: 0,
        timeInSeconds: 0,
        frequencyInHertz: single.frequencyInHertz,
        probability: single.probability,
      },
    ]
  }

  const contour: YinPitchContourFrame[] = []
  let frameIndex = 0
  for (
    let startSample = 0;
    startSample + frameLengthInSamples <= samples.length;
    startSample += hopLengthInSamples
  ) {
    const frame = samples.subarray(startSample, startSample + frameLengthInSamples)
    const estimate = estimatePitchWithYin(frame, sampleRateInHertz, options)
    contour.push({
      frameIndex,
      timeInSeconds: startSample / sampleRateInHertz,
      frequencyInHertz: estimate.frequencyInHertz,
      probability: estimate.probability,
    })
    frameIndex += 1
  }

  return contour
}

/** Mean of voiced F0 values; null if no voiced frames. */
export function computeMeanVoicedPitchInHertz(
  contour: readonly YinPitchContourFrame[],
): number | null {
  let sum = 0
  let count = 0
  for (const frame of contour) {
    if (frame.frequencyInHertz !== null && Number.isFinite(frame.frequencyInHertz)) {
      sum += frame.frequencyInHertz
      count += 1
    }
  }
  if (count === 0) {
    return null
  }
  return sum / count
}

function computePeakAbsolute(samples: Float32Array): number {
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) {
    const absoluteValue = Math.abs(samples[index] ?? 0)
    if (absoluteValue > peak) {
      peak = absoluteValue
    }
  }
  return peak
}

/**
 * Step 1–2 of YIN: d(τ) = Σ_j (x_j − x_{j+τ})² for τ = 0..maxPeriod.
 * Integration window length = samples.length − maxPeriod (fixed for all τ).
 */
function computeYinDifferenceFunction(
  samples: Float32Array,
  maximumPeriodInSamples: number,
): Float32Array {
  const difference = new Float32Array(maximumPeriodInSamples + 1)
  const windowLength = samples.length - maximumPeriodInSamples

  for (let tau = 1; tau <= maximumPeriodInSamples; tau += 1) {
    let sum = 0
    for (let index = 0; index < windowLength; index += 1) {
      const delta = (samples[index] ?? 0) - (samples[index + tau] ?? 0)
      sum += delta * delta
    }
    difference[tau] = sum
  }

  difference[0] = 0
  return difference
}

/**
 * Step 3 of YIN: cumulative mean normalized difference function d'(τ).
 * d'(0) = 1; d'(τ) = d(τ) / ((1/τ) Σ_{j=1..τ} d(j))
 */
function computeCumulativeMeanNormalizedDifference(
  differenceFunction: Float32Array,
): Float32Array {
  const normalized = new Float32Array(differenceFunction.length)
  normalized[0] = 1

  let runningSum = 0
  for (let tau = 1; tau < differenceFunction.length; tau += 1) {
    runningSum += differenceFunction[tau] ?? 0
    if (runningSum === 0) {
      normalized[tau] = 1
    } else {
      normalized[tau] = ((differenceFunction[tau] ?? 0) * tau) / runningSum
    }
  }

  return normalized
}

/**
 * Step 4: smallest τ ≥ minPeriod where d'(τ) < threshold, then local minimum.
 * Returns null if no lag dips below the threshold in range.
 */
function findAbsoluteThresholdCrossing(
  cumulativeMeanNormalizedDifference: Float32Array,
  minimumPeriodInSamples: number,
  maximumPeriodInSamples: number,
  absoluteThreshold: number,
): number | null {
  const lastLag = Math.min(maximumPeriodInSamples, cumulativeMeanNormalizedDifference.length - 1)

  for (let tau = minimumPeriodInSamples; tau <= lastLag; tau += 1) {
    const value = cumulativeMeanNormalizedDifference[tau] ?? 1
    if (value < absoluteThreshold) {
      // Walk to the local minimum while still decreasing.
      let localMinTau = tau
      while (
        localMinTau + 1 <= lastLag &&
        (cumulativeMeanNormalizedDifference[localMinTau + 1] ?? 1) <
          (cumulativeMeanNormalizedDifference[localMinTau] ?? 1)
      ) {
        localMinTau += 1
      }
      return localMinTau
    }
  }

  return null
}

function findGlobalMinimumLag(
  cumulativeMeanNormalizedDifference: Float32Array,
  minimumPeriodInSamples: number,
  maximumPeriodInSamples: number,
): number | null {
  const lastLag = Math.min(maximumPeriodInSamples, cumulativeMeanNormalizedDifference.length - 1)
  if (minimumPeriodInSamples > lastLag) {
    return null
  }

  let bestTau = minimumPeriodInSamples
  let bestValue = cumulativeMeanNormalizedDifference[bestTau] ?? 1
  for (let tau = minimumPeriodInSamples + 1; tau <= lastLag; tau += 1) {
    const value = cumulativeMeanNormalizedDifference[tau] ?? 1
    if (value < bestValue) {
      bestValue = value
      bestTau = tau
    }
  }
  return bestTau
}

/**
 * Step 5: parabolic interpolation around the discrete minimum for sub-sample period.
 * Uses d'(τ−1), d'(τ), d'(τ+1).
 */
function refinePeriodWithParabolicInterpolation(
  cumulativeMeanNormalizedDifference: Float32Array,
  tau: number,
): number {
  if (tau <= 0 || tau >= cumulativeMeanNormalizedDifference.length - 1) {
    return tau
  }

  const previous = cumulativeMeanNormalizedDifference[tau - 1] ?? 0
  const current = cumulativeMeanNormalizedDifference[tau] ?? 0
  const next = cumulativeMeanNormalizedDifference[tau + 1] ?? 0
  // Standard parabola through d'(τ−1), d'(τ), d'(τ+1); vertex offset in samples.
  const denominator = previous - 2 * current + next
  if (denominator === 0) {
    return tau
  }

  const offset = (previous - next) / (2 * denominator)
  // Guard against runaway offsets on flat/noisy neighborhoods.
  if (!Number.isFinite(offset) || Math.abs(offset) > 1) {
    return tau
  }

  return tau + offset
}
