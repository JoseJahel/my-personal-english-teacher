/**
 * Compare median F1–F2–F3 (log-Hz) user vs TTS reference (issue #58).
 * Needs F1 and F2 on both sides; F3 is included when both have it.
 */

import { convertDtwDistanceToPronunciationScore } from './dynamic-time-warping'
import {
  computeMedianFormants,
  extractFormantContour,
  type FormantTriple,
} from './formant-estimation'

/** Provisional half-score on log-Hz Euclidean distance (not panel-fitted). */
export const DEFAULT_FORMANT_LOG_HZ_DISTANCE_AT_HALF_SCORE = 0.45

export interface FormantMedianScore {
  readonly score0to100: number
  readonly logHertzDistance: number
  readonly userMedian: FormantTriple
  readonly referenceMedian: FormantTriple
}

export function scoreFormantMediansFromMonoPcm(
  userSamples: Float32Array,
  referenceSamples: Float32Array,
  sampleRateInHertz: number,
  options?: { readonly distanceAtHalfScore?: number },
): FormantMedianScore | null {
  if (userSamples.length === 0 || referenceSamples.length === 0 || !(sampleRateInHertz > 0)) {
    return null
  }
  const userMedian = computeMedianFormants(extractFormantContour(userSamples, sampleRateInHertz))
  const referenceMedian = computeMedianFormants(
    extractFormantContour(referenceSamples, sampleRateInHertz),
  )
  const logHertzDistance = computeLogHertzFormantDistance(userMedian, referenceMedian)
  if (logHertzDistance === null) {
    return null
  }
  return {
    logHertzDistance,
    userMedian,
    referenceMedian,
    score0to100: convertDtwDistanceToPronunciationScore(logHertzDistance, {
      distanceAtHalfScore:
        options?.distanceAtHalfScore ?? DEFAULT_FORMANT_LOG_HZ_DISTANCE_AT_HALF_SCORE,
    }),
  }
}

export function computeLogHertzFormantDistance(
  user: FormantTriple,
  reference: FormantTriple,
): number | null {
  const pairs: Array<readonly [number, number]> = []
  if (user.f1InHertz !== null && reference.f1InHertz !== null) {
    pairs.push([user.f1InHertz, reference.f1InHertz])
  }
  if (user.f2InHertz !== null && reference.f2InHertz !== null) {
    pairs.push([user.f2InHertz, reference.f2InHertz])
  }
  if (pairs.length < 2) {
    return null
  }
  if (user.f3InHertz !== null && reference.f3InHertz !== null) {
    pairs.push([user.f3InHertz, reference.f3InHertz])
  }
  let sumOfSquares = 0
  for (const [userHertz, referenceHertz] of pairs) {
    if (!(userHertz > 0) || !(referenceHertz > 0)) {
      return null
    }
    const delta = Math.log(userHertz) - Math.log(referenceHertz)
    sumOfSquares += delta * delta
  }
  return Math.sqrt(sumOfSquares)
}
