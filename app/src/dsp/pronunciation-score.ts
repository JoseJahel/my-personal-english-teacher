/**
 * Pronunciation score from two mono PCM utterances (user vs reference).
 * Pure domain: MFCC + pitch + energy + formants → 0–100 (issue #58).
 * Callers must pass buffers at the **same** sample rate (e.g. both 16 kHz).
 */

import {
  combinePronunciationBranchScores,
  DEFAULT_PRONUNCIATION_BRANCH_WEIGHTS,
} from './combine-pronunciation-branch-scores'
import {
  computeDynamicTimeWarping,
  convertDtwDistanceToPronunciationScore,
  centerVoicedPitchContourInHertz,
  pitchContourToFeatureFrames,
  zScoreNormalizeFeatureSequence,
} from './dynamic-time-warping'
import { extractMfccSequence } from './mfcc-extraction'
import {
  extractPitchContourWithYin,
} from './pitch-detection-yin'
import { scoreEnergyContourFromMonoPcm } from './score-energy-contour'
import { scoreFormantMediansFromMonoPcm } from './score-formant-distance'
import {
  CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE,
  CALIBRATED_MFCC_SCORE_WEIGHT,
  CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE,
} from './pronunciation-score-calibration-constants'
import {
  buildWordPronunciationHighlights,
  computeMeanLocalCostPerQueryFrame,
  tokenizeEnglishWords,
  type WordPronunciationHighlight,
} from './word-pronunciation-highlights'

/**
 * Default half-score distance for MFCC DTW.
 * Source: multi-speaker offline calibration (issue #29) — see
 * `run-pronunciation-score-calibration.ts` and
 * `Documentacion general/calibracion-score-pronunciacion.md`.
 */
export const DEFAULT_MFCC_DISTANCE_AT_HALF_SCORE = CALIBRATED_MFCC_DISTANCE_AT_HALF_SCORE

/** Default half-score distance for relative pitch DTW (calibrated, issue #29). */
export const DEFAULT_PITCH_DISTANCE_AT_HALF_SCORE = CALIBRATED_PITCH_DISTANCE_AT_HALF_SCORE

/** Weight of MFCC score when pitch score is available (calibrated, issue #29). */
export const DEFAULT_MFCC_SCORE_WEIGHT = CALIBRATED_MFCC_SCORE_WEIGHT

export interface PronunciationScoreResult {
  /** Combined score in [0, 100]; higher is better match to the reference. */
  readonly score0to100: number
  readonly mfccScore0to100: number
  readonly pitchScore0to100: number | null
  readonly energyScore0to100: number | null
  readonly formantScore0to100: number | null
  readonly mfccNormalizedDistance: number
  readonly pitchNormalizedDistance: number | null
  readonly energyNormalizedDistance: number | null
  readonly formantLogHertzDistance: number | null
  readonly userMfccFrameCount: number
  readonly referenceMfccFrameCount: number
  readonly dtwPathLength: number
  /** Word-level bands when `referenceTextForHighlights` was provided. */
  readonly wordHighlights: readonly WordPronunciationHighlight[]
}

export interface PronunciationScoreOptions {
  readonly mfccDistanceAtHalfScore?: number
  readonly pitchDistanceAtHalfScore?: number
  readonly energyDistanceAtHalfScore?: number
  readonly formantDistanceAtHalfScore?: number
  readonly mfccScoreWeight?: number
  readonly energyScoreWeight?: number
  readonly formantScoreWeight?: number
  /** When false, skip YIN/pitch branch. Default true. */
  readonly includePitch?: boolean
  /** When false, skip the energy-envelope branch (issue #58). Default true. */
  readonly includeEnergy?: boolean
  /** When false, skip the formant-median branch (issue #58). Default true. */
  readonly includeFormants?: boolean
  readonly sakoeChibaRadiusInFrames?: number
  /**
   * English phrase (usually grammar-corrected transcript) used to paint
   * word-level highlights from the MFCC DTW path.
   */
  readonly referenceTextForHighlights?: string
}

/**
 * Score how close `userSamples` is to `referenceSamples` (e.g. TTS of the target phrase).
 * Both must share `sampleRateInHertz`. Returns null when inputs are unusable.
 */
export function scorePronunciationFromMonoPcm(
  userSamples: Float32Array,
  referenceSamples: Float32Array,
  sampleRateInHertz: number,
  options?: PronunciationScoreOptions,
): PronunciationScoreResult | null {
  if (
    userSamples.length === 0 ||
    referenceSamples.length === 0 ||
    sampleRateInHertz <= 0
  ) {
    return null
  }

  const includePitch = options?.includePitch ?? true
  const includeEnergy = options?.includeEnergy ?? true
  const includeFormants = options?.includeFormants ?? true
  const mfccDistanceAtHalfScore =
    options?.mfccDistanceAtHalfScore ?? DEFAULT_MFCC_DISTANCE_AT_HALF_SCORE
  const pitchDistanceAtHalfScore =
    options?.pitchDistanceAtHalfScore ?? DEFAULT_PITCH_DISTANCE_AT_HALF_SCORE
  const sakoeChibaRadiusInFrames = options?.sakoeChibaRadiusInFrames

  const userMfcc = extractMfccSequence(userSamples, sampleRateInHertz)
  const referenceMfcc = extractMfccSequence(referenceSamples, sampleRateInHertz)
  if (userMfcc.length === 0 || referenceMfcc.length === 0) {
    return null
  }

  const userMfccFrames = zScoreNormalizeFeatureSequence(
    userMfcc.map((frame) => frame.coefficients),
  )
  const referenceMfccFrames = zScoreNormalizeFeatureSequence(
    referenceMfcc.map((frame) => frame.coefficients),
  )

  const mfccDtw = computeDynamicTimeWarping(userMfccFrames, referenceMfccFrames, {
    sakoeChibaRadiusInFrames,
  })
  if (!Number.isFinite(mfccDtw.normalizedDistance)) {
    return null
  }

  const mfccScore0to100 = convertDtwDistanceToPronunciationScore(mfccDtw.normalizedDistance, {
    distanceAtHalfScore: mfccDistanceAtHalfScore,
  })

  let pitchScore0to100: number | null = null
  let pitchNormalizedDistance: number | null = null
  let energyScore0to100: number | null = null
  let energyNormalizedDistance: number | null = null
  let formantScore0to100: number | null = null
  let formantLogHertzDistance: number | null = null

  if (includePitch) {
    const pitchComparison = scoreRelativePitchContours(
      userSamples,
      referenceSamples,
      sampleRateInHertz,
      pitchDistanceAtHalfScore,
      sakoeChibaRadiusInFrames,
    )
    if (pitchComparison) {
      pitchScore0to100 = pitchComparison.score0to100
      pitchNormalizedDistance = pitchComparison.normalizedDistance
    }
  }

  if (includeEnergy) {
    const energyComparison = scoreEnergyContourFromMonoPcm(
      userSamples,
      referenceSamples,
      sampleRateInHertz,
      {
        distanceAtHalfScore: options?.energyDistanceAtHalfScore,
        sakoeChibaRadiusInFrames,
      },
    )
    if (energyComparison) {
      energyScore0to100 = energyComparison.score0to100
      energyNormalizedDistance = energyComparison.normalizedDistance
    }
  }

  if (includeFormants) {
    const formantComparison = scoreFormantMediansFromMonoPcm(
      userSamples,
      referenceSamples,
      sampleRateInHertz,
      { distanceAtHalfScore: options?.formantDistanceAtHalfScore },
    )
    if (formantComparison) {
      formantScore0to100 = formantComparison.score0to100
      formantLogHertzDistance = formantComparison.logHertzDistance
    }
  }

  const score0to100 = combinePronunciationBranchScores({
    mfccScore0to100,
    pitchScore0to100,
    energyScore0to100,
    formantScore0to100,
    weights: {
      mfcc: clampUnit(options?.mfccScoreWeight ?? DEFAULT_PRONUNCIATION_BRANCH_WEIGHTS.mfcc),
      pitch: DEFAULT_PRONUNCIATION_BRANCH_WEIGHTS.pitch,
      energy: clampUnit(options?.energyScoreWeight ?? DEFAULT_PRONUNCIATION_BRANCH_WEIGHTS.energy),
      formant: clampUnit(
        options?.formantScoreWeight ?? DEFAULT_PRONUNCIATION_BRANCH_WEIGHTS.formant,
      ),
    },
  })

  const wordHighlights = buildHighlightsFromMfccPath(
    options?.referenceTextForHighlights,
    userMfccFrames,
    referenceMfccFrames,
    mfccDtw.path,
    mfccDistanceAtHalfScore,
  )

  return {
    score0to100: roundScore(score0to100),
    mfccScore0to100: roundScore(mfccScore0to100),
    pitchScore0to100: pitchScore0to100 === null ? null : roundScore(pitchScore0to100),
    energyScore0to100: energyScore0to100 === null ? null : roundScore(energyScore0to100),
    formantScore0to100: formantScore0to100 === null ? null : roundScore(formantScore0to100),
    mfccNormalizedDistance: mfccDtw.normalizedDistance,
    pitchNormalizedDistance,
    energyNormalizedDistance,
    formantLogHertzDistance,
    userMfccFrameCount: userMfcc.length,
    referenceMfccFrameCount: referenceMfcc.length,
    dtwPathLength: mfccDtw.path.length,
    wordHighlights,
  }
}

function buildHighlightsFromMfccPath(
  referenceTextForHighlights: string | undefined,
  userMfccFrames: readonly Float32Array[],
  referenceMfccFrames: readonly Float32Array[],
  path: readonly { queryIndex: number; referenceIndex: number }[],
  mfccDistanceAtHalfScore: number,
): WordPronunciationHighlight[] {
  const text = referenceTextForHighlights?.trim() ?? ''
  if (!text || path.length === 0) {
    return []
  }
  const words = tokenizeEnglishWords(text)
  if (words.length === 0) {
    return []
  }
  const meanLocalCostPerQueryFrame = computeMeanLocalCostPerQueryFrame(
    userMfccFrames,
    referenceMfccFrames,
    path,
  )
  return buildWordPronunciationHighlights(words, meanLocalCostPerQueryFrame, {
    distanceAtHalfScore: mfccDistanceAtHalfScore,
  })
}

function scoreRelativePitchContours(
  userSamples: Float32Array,
  referenceSamples: Float32Array,
  sampleRateInHertz: number,
  pitchDistanceAtHalfScore: number,
  sakoeChibaRadiusInFrames: number | undefined,
): { score0to100: number; normalizedDistance: number } | null {
  const userContour = extractPitchContourWithYin(userSamples, sampleRateInHertz)
  const referenceContour = extractPitchContourWithYin(referenceSamples, sampleRateInHertz)

  const userCentered = centerVoicedPitchContourInHertz(
    userContour.map((frame) => frame.frequencyInHertz),
  )
  const referenceCentered = centerVoicedPitchContourInHertz(
    referenceContour.map((frame) => frame.frequencyInHertz),
  )

  const userHasVoiced = userCentered.some((value) => value !== null)
  const referenceHasVoiced = referenceCentered.some((value) => value !== null)
  if (!userHasVoiced || !referenceHasVoiced) {
    return null
  }

  const pitchDtw = computeDynamicTimeWarping(
    pitchContourToFeatureFrames(userCentered),
    pitchContourToFeatureFrames(referenceCentered),
    { sakoeChibaRadiusInFrames },
  )
  if (!Number.isFinite(pitchDtw.normalizedDistance)) {
    return null
  }

  return {
    normalizedDistance: pitchDtw.normalizedDistance,
    score0to100: convertDtwDistanceToPronunciationScore(pitchDtw.normalizedDistance, {
      distanceAtHalfScore: pitchDistanceAtHalfScore,
    }),
  }
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MFCC_SCORE_WEIGHT
  }
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

function roundScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10
}
