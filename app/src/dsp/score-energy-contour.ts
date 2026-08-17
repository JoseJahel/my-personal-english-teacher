/**
 * Compare user vs reference energy envelopes (issue #58).
 * Log-RMS frames, z-scored, then DTW — loudness offset does not dominate.
 */

import {
  computeDynamicTimeWarping,
  convertDtwDistanceToPronunciationScore,
  zScoreNormalizeFeatureSequence,
} from './dynamic-time-warping'
import { extractLogRmsEnergyFrames } from './energy-contour'

/** Provisional half-score (not multi-speaker fitted). */
export const DEFAULT_ENERGY_DISTANCE_AT_HALF_SCORE = 1.8

export interface EnergyContourScore {
  readonly score0to100: number
  readonly normalizedDistance: number
}

export function scoreEnergyContourFromMonoPcm(
  userSamples: Float32Array,
  referenceSamples: Float32Array,
  sampleRateInHertz: number,
  options?: {
    readonly distanceAtHalfScore?: number
    readonly sakoeChibaRadiusInFrames?: number
  },
): EnergyContourScore | null {
  if (userSamples.length === 0 || referenceSamples.length === 0 || !(sampleRateInHertz > 0)) {
    return null
  }
  const userFrames = zScoreNormalizeFeatureSequence(
    extractLogRmsEnergyFrames(userSamples, sampleRateInHertz),
  )
  const referenceFrames = zScoreNormalizeFeatureSequence(
    extractLogRmsEnergyFrames(referenceSamples, sampleRateInHertz),
  )
  if (userFrames.length === 0 || referenceFrames.length === 0) {
    return null
  }
  const alignment = computeDynamicTimeWarping(userFrames, referenceFrames, {
    sakoeChibaRadiusInFrames: options?.sakoeChibaRadiusInFrames,
  })
  if (!Number.isFinite(alignment.normalizedDistance)) {
    return null
  }
  return {
    normalizedDistance: alignment.normalizedDistance,
    score0to100: convertDtwDistanceToPronunciationScore(alignment.normalizedDistance, {
      distanceAtHalfScore: options?.distanceAtHalfScore ?? DEFAULT_ENERGY_DISTANCE_AT_HALF_SCORE,
    }),
  }
}
