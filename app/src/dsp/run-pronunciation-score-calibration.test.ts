import { describe, expect, it } from 'vitest'
import { convertDtwDistanceToPronunciationScore } from './dynamic-time-warping'
import { getPronunciationScoreCalibrationProtocolSummary } from './pronunciation-score-calibration-protocol'
import {
  CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD,
  CALIBRATED_HIGHLIGHT_MEDIUM_SCORE_THRESHOLD,
  CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE,
  CALIBRATED_MFCC_SCORE_WEIGHT,
  CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE,
  productionConstantsMatchCalibrationPanel,
  runPronunciationScoreCalibration,
} from './run-pronunciation-score-calibration'
import {
  DEFAULT_MFCC_DISTANCE_AT_HALF_SCORE,
  DEFAULT_MFCC_SCORE_WEIGHT,
  DEFAULT_PITCH_DISTANCE_AT_HALF_SCORE,
} from './pronunciation-score'

describe('pronunciation score calibration (issue #29)', () => {
  it('documents a multi-phrase multi-speaker protocol', () => {
    const summary = getPronunciationScoreCalibrationProtocolSummary()
    expect(summary.phraseCount).toBe(8)
    expect(summary.speakerCount).toBe(2)
    expect(summary.qualityTierCount).toBe(4)
    expect(summary.expectedLabeledPairCount).toBe(64)
  })

  it('fits MFCC distanceAtHalfScore from the offline multi-speaker panel', () => {
    const run = runPronunciationScoreCalibration()

    expect(run.phraseCount).toBe(8)
    expect(run.speakerCount).toBe(2)
    expect(run.protocolExpectedPairCount).toBe(64)
    expect(run.mfccFit.sampleCount).toBe(64)
    expect(run.mfccFit.distanceAtHalfScore).toBeGreaterThan(10)
    expect(run.mfccFit.distanceAtHalfScore).toBeLessThan(25)
    expect(run.mfccFit.rootMeanSquareErrorInScorePoints).toBeLessThan(20)
    expect(run.pitchFit).not.toBeNull()
    expect(run.pitchFit!.sampleCount).toBe(64)
  })

  it('applies calibrated defaults in pronunciation-score and highlights', () => {
    expect(DEFAULT_MFCC_DISTANCE_AT_HALF_SCORE).toBe(CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE)
    expect(DEFAULT_PITCH_DISTANCE_AT_HALF_SCORE).toBe(CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE)
    expect(DEFAULT_MFCC_SCORE_WEIGHT).toBe(CALIBRATED_MFCC_SCORE_WEIGHT)
    expect(CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD).toBe(72)
    expect(CALIBRATED_HIGHLIGHT_MEDIUM_SCORE_THRESHOLD).toBe(48)
    expect(productionConstantsMatchCalibrationPanel()).toBe(true)
  })

  it('maps half-score distance to ~50 under the calibrated curve', () => {
    const scoreAtHalf = convertDtwDistanceToPronunciationScore(
      CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE,
      { distanceAtHalfScore: CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE },
    )
    expect(scoreAtHalf).toBeCloseTo(50, 0)
  })
})
