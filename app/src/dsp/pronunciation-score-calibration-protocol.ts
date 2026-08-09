/**
 * Offline calibration protocol for pronunciation score 0–100 (issue #29).
 *
 * Defines N fixed practice phrases, multi-speaker acoustic conditions, and a
 * human-rating rubric so distance→score mapping can be fit reproducibly.
 * Pure domain: no I/O. Real-speaker re-runs should keep the same phrase list
 * and rubrics, replace synthetic PCM with recorded pairs, and re-fit.
 */

/** Fixed English phrases used for the calibration panel (N = 8). */
export const CALIBRATION_PHRASE_BANK_EN = [
  'I would like a glass of water, please.',
  'Where is gate B twelve for my flight?',
  'My name is Ana and I am a software engineer.',
  'Can I have the bill with a card, please?',
  'I need to check in and print my boarding pass.',
  'Could you recommend a vegetarian main course?',
  'I solved a hard project deadline with my team.',
  'Would you like coffee or tea with that order?',
] as const

export type CalibrationPhraseId = (typeof CALIBRATION_PHRASE_BANK_EN)[number]

/**
 * Synthetic multi-speaker conditions that stand in for 2+ talkers when
 * recorded corpora are unavailable. Real re-calibration should replace these
 * with named speakers (e.g. speaker-A, speaker-B) recorded in a quiet room.
 */
export const CALIBRATION_SPEAKER_PROFILES = [
  {
    id: 'speaker-a-lower-pitch',
    labelEn: 'Speaker A (lower F0, male-like ~120 Hz base)',
    baseFrequencyInHertz: 120,
  },
  {
    id: 'speaker-b-higher-pitch',
    labelEn: 'Speaker B (higher F0, female-like ~210 Hz base)',
    baseFrequencyInHertz: 210,
  },
] as const

export type CalibrationSpeakerId = (typeof CALIBRATION_SPEAKER_PROFILES)[number]['id']

/**
 * Quality tiers used as the human-rating rubric (0–100).
 * Raters score each user-vs-reference pair into a tier midpoint, then may
 * nudge ±5 for borderline cases.
 */
export const CALIBRATION_QUALITY_TIERS = {
  excellent: {
    id: 'excellent',
    humanScore0to100: 95,
    descriptionEn: 'Same content and timing as the reference (near-native match).',
  },
  good: {
    id: 'good',
    humanScore0to100: 78,
    descriptionEn: 'Same words, mild speed change only (still clearly intelligible).',
  },
  fair: {
    id: 'fair',
    humanScore0to100: 55,
    descriptionEn: 'Same phrase with noticeable pitch/identity mismatch.',
  },
  poor: {
    id: 'poor',
    humanScore0to100: 28,
    descriptionEn: 'Wrong pitch band and added noise — clearly off-target.',
  },
} as const

export type CalibrationQualityTierId = keyof typeof CALIBRATION_QUALITY_TIERS

export interface CalibrationProtocolSummary {
  readonly phraseCount: number
  readonly speakerCount: number
  readonly qualityTierCount: number
  /** Expected labeled pairs = phrases × speakers × tiers (before filtering). */
  readonly expectedLabeledPairCount: number
  readonly minimumUsableSamplesForFit: number
}

/** Documented protocol knobs for the delivery report / re-runs. */
export function getPronunciationScoreCalibrationProtocolSummary(): CalibrationProtocolSummary {
  return {
    phraseCount: CALIBRATION_PHRASE_BANK_EN.length,
    speakerCount: CALIBRATION_SPEAKER_PROFILES.length,
    qualityTierCount: Object.keys(CALIBRATION_QUALITY_TIERS).length,
    expectedLabeledPairCount:
      CALIBRATION_PHRASE_BANK_EN.length *
      CALIBRATION_SPEAKER_PROFILES.length *
      Object.keys(CALIBRATION_QUALITY_TIERS).length,
    minimumUsableSamplesForFit: 3,
  }
}
