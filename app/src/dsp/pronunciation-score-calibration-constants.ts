/**
 * Frozen production defaults from the multi-speaker offline calibration
 * (issue #29). Recompute with `runPronunciationScoreCalibration()` when
 * re-labeling real speakers, then update these numbers intentionally.
 *
 * Protocol: 8 phrases × 2 speakers × 4 quality tiers — see
 * `pronunciation-score-calibration-protocol.ts` and
 * `Documentacion general/calibracion-score-pronunciacion.md`.
 */

/** MFCC DTW distance that maps to score 50 under the exponential mapping. */
export const CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE = 16.5

/** Relative-pitch DTW distance that maps to score 50. */
export const CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE = 11.2

/** Weight of the MFCC branch when pitch is available (pitch gets the rest). */
export const CALIBRATED_MFCC_SCORE_WEIGHT = 0.78

/** Word highlight: score ≥ this → band `good`. */
export const CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD = 72

/** Word highlight: score ≥ this (and &lt; good) → band `medium`; else `poor`. */
export const CALIBRATED_HIGHLIGHT_MEDIUM_SCORE_THRESHOLD = 48
