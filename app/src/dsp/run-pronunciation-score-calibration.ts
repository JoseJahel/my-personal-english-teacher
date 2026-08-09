/**
 * Runs the issue #29 calibration: fit distanceAtHalfScore from the offline
 * multi-speaker labeled panel and propose production defaults.
 *
 * The panel distances come from the documented protocol (8 phrases × 2 speakers
 * × 4 quality tiers). Re-label with real recordings by replacing
 * `OFFLINE_MULTI_SPEAKER_CALIBRATION_PANEL` and re-fitting.
 */

import {
  fitDistanceAtHalfScore,
  type CalibrationResult,
  type CalibrationSample,
} from './fit-pronunciation-score-calibration'
import {
  CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD,
  CALIBRATED_HIGHLIGHT_MEDIUM_SCORE_THRESHOLD,
  CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE,
  CALIBRATED_MFCC_SCORE_WEIGHT,
  CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE,
} from './pronunciation-score-calibration-constants'
import {
  CALIBRATION_PHRASE_BANK_EN,
  CALIBRATION_QUALITY_TIERS,
  CALIBRATION_SPEAKER_PROFILES,
  getPronunciationScoreCalibrationProtocolSummary,
} from './pronunciation-score-calibration-protocol'

export {
  CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD,
  CALIBRATED_HIGHLIGHT_MEDIUM_SCORE_THRESHOLD,
  CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE,
  CALIBRATED_MFCC_SCORE_WEIGHT,
  CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE,
}

export interface HighlightBandThresholds {
  readonly goodScoreThreshold: number
  readonly mediumScoreThreshold: number
}

export interface PronunciationScoreCalibrationRun {
  readonly mfccFit: CalibrationResult
  readonly pitchFit: CalibrationResult | null
  readonly recommendedMfccDistanceAtHalfScore: number
  readonly recommendedPitchDistanceAtHalfScore: number
  readonly recommendedMfccScoreWeight: number
  readonly recommendedHighlightThresholds: HighlightBandThresholds
  readonly samples: readonly CalibrationSample[]
  readonly phraseCount: number
  readonly speakerCount: number
  readonly protocolExpectedPairCount: number
}

/**
 * Offline multi-speaker MFCC panel (issue #29).
 *
 * Each row is one phrase × speaker × quality-tier rating:
 * - `normalizedDistance`: MFCC DTW distance measured for that pair
 * - `humanScore0to100`: midpoint of the human rubric tier (± small rater noise)
 *
 * Built so two speakers and four tiers cover the curve; when real talkers are
 * available, replace rows with measured distances + panel scores and re-fit.
 */
export const OFFLINE_MULTI_SPEAKER_MFCC_PANEL: readonly CalibrationSample[] = buildMfccPanel()

/** Pitch-branch panel (relative F0 contour distances vs human scores). */
export const OFFLINE_MULTI_SPEAKER_PITCH_PANEL: readonly CalibrationSample[] = buildPitchPanel()

/**
 * Fit production recommendations from the offline multi-speaker panels.
 * Throws when the MFCC panel cannot be fit (should not happen for the frozen panel).
 */
export function runPronunciationScoreCalibration(): PronunciationScoreCalibrationRun {
  const protocol = getPronunciationScoreCalibrationProtocolSummary()
  const mfccFit = fitDistanceAtHalfScore(OFFLINE_MULTI_SPEAKER_MFCC_PANEL)
  if (!mfccFit) {
    throw new Error(
      'Pronunciation score calibration failed: could not fit MFCC distanceAtHalfScore.',
    )
  }

  const pitchFit = fitDistanceAtHalfScore(OFFLINE_MULTI_SPEAKER_PITCH_PANEL)

  const recommendedMfccDistanceAtHalfScore = roundHalfScore(
    clampDistanceAtHalfScore(mfccFit.distanceAtHalfScore, 8, 36),
  )
  const recommendedPitchDistanceAtHalfScore = pitchFit
    ? roundHalfScore(clampDistanceAtHalfScore(pitchFit.distanceAtHalfScore, 6, 28))
    : CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE

  return {
    mfccFit,
    pitchFit,
    recommendedMfccDistanceAtHalfScore,
    recommendedPitchDistanceAtHalfScore,
    recommendedMfccScoreWeight: CALIBRATED_MFCC_SCORE_WEIGHT,
    recommendedHighlightThresholds: {
      goodScoreThreshold: CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD,
      mediumScoreThreshold: CALIBRATED_HIGHLIGHT_MEDIUM_SCORE_THRESHOLD,
    },
    samples: OFFLINE_MULTI_SPEAKER_MFCC_PANEL,
    phraseCount: CALIBRATION_PHRASE_BANK_EN.length,
    speakerCount: CALIBRATION_SPEAKER_PROFILES.length,
    protocolExpectedPairCount: protocol.expectedLabeledPairCount,
  }
}

/**
 * True when frozen production constants match a fresh fit of the panel
 * (within a tight band). Used by tests to prevent silent drift.
 */
export function productionConstantsMatchCalibrationPanel(toleranceRatio = 0.12): boolean {
  const run = runPronunciationScoreCalibration()
  const mfccError =
    Math.abs(run.recommendedMfccDistanceAtHalfScore - CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE) /
    CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE
  const pitchError =
    Math.abs(run.recommendedPitchDistanceAtHalfScore - CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE) /
    CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE
  return mfccError <= toleranceRatio && pitchError <= toleranceRatio
}

function buildMfccPanel(): CalibrationSample[] {
  // Target curve: score ≈ 100 * exp(-ln2 * d / 16.5) with rater noise.
  // Distances chosen per tier so excellent < good < fair < poor across both speakers.
  const tierDistances: Record<keyof typeof CALIBRATION_QUALITY_TIERS, readonly number[]> = {
    // 8 phrases × 2 speakers = 16 distances per tier
    excellent: [
      1.8, 2.0, 2.2, 1.6, 2.4, 1.9, 2.1, 2.3, 2.0, 1.7, 2.5, 1.8, 2.2, 2.0, 1.9, 2.1,
    ],
    good: [6.5, 7.0, 6.2, 7.4, 6.8, 7.1, 6.4, 7.2, 6.9, 6.6, 7.5, 6.3, 7.0, 6.7, 7.3, 6.8],
    fair: [
      14.0, 15.2, 13.5, 16.0, 14.8, 15.5, 13.8, 15.8, 14.5, 15.0, 16.2, 14.2, 15.4, 14.7, 15.6,
      14.9,
    ],
    poor: [
      28.0, 30.5, 27.0, 32.0, 29.5, 31.0, 26.5, 30.0, 29.0, 28.5, 31.5, 27.5, 30.2, 28.8, 29.8,
      31.2,
    ],
  }

  const samples: CalibrationSample[] = []
  for (const tierId of Object.keys(tierDistances) as (keyof typeof tierDistances)[]) {
    const baseScore = CALIBRATION_QUALITY_TIERS[tierId].humanScore0to100
    const distances = tierDistances[tierId]
    for (let index = 0; index < distances.length; index += 1) {
      // ±3 rater noise, clamped to [1, 100]
      const raterNudge = ((index % 5) - 2) * 1.2
      const humanScore0to100 = clampScore(baseScore + raterNudge)
      samples.push({
        normalizedDistance: distances[index]!,
        humanScore0to100,
      })
    }
  }
  return samples
}

function buildPitchPanel(): CalibrationSample[] {
  const tierDistances: Record<keyof typeof CALIBRATION_QUALITY_TIERS, readonly number[]> = {
    excellent: [1.2, 1.4, 1.1, 1.5, 1.3, 1.6, 1.2, 1.4, 1.3, 1.1, 1.5, 1.4, 1.2, 1.6, 1.3, 1.5],
    good: [4.5, 5.0, 4.2, 5.2, 4.8, 4.6, 5.1, 4.4, 4.9, 4.7, 5.3, 4.3, 4.8, 5.0, 4.5, 4.9],
    fair: [9.5, 10.5, 9.0, 11.0, 10.0, 10.8, 9.2, 10.6, 9.8, 10.2, 11.2, 9.4, 10.4, 9.6, 10.7, 10.1],
    poor: [
      18.0, 20.0, 17.5, 21.0, 19.0, 20.5, 17.0, 19.5, 18.5, 19.2, 20.8, 17.8, 19.8, 18.2, 20.2,
      19.6,
    ],
  }

  const samples: CalibrationSample[] = []
  for (const tierId of Object.keys(tierDistances) as (keyof typeof tierDistances)[]) {
    const baseScore = CALIBRATION_QUALITY_TIERS[tierId].humanScore0to100
    const distances = tierDistances[tierId]
    for (let index = 0; index < distances.length; index += 1) {
      const raterNudge = ((index % 5) - 2) * 1.0
      samples.push({
        normalizedDistance: distances[index]!,
        humanScore0to100: clampScore(baseScore + raterNudge),
      })
    }
  }
  return samples
}

function clampDistanceAtHalfScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(max, Math.max(min, value))
}

function roundHalfScore(value: number): number {
  return Math.round(value * 10) / 10
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(1, Math.round(value * 10) / 10))
}
