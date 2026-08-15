/**
 * Frozen speaker-bias table from measureSpeakerBiasOnPronunciationScore()
 * (issue #95). Re-run the protocol before changing these numbers.
 */

export type SpeakerBiasProductPolicy =
  | 'keep-conversation-score'
  | 'conversation-score-secondary'
  | 'drill-only'

/** Same buffer vs itself. */
export const SPEAKER_BIAS_MEAN_SAME_SPEAKER_SCORE = 100
/** Same vowels, F0 120 Hz vs 210 Hz. */
export const SPEAKER_BIAS_MEAN_SPEAKER_CHANGE_SCORE = 88.6
/** Same F0, different vowel identities. */
export const SPEAKER_BIAS_MEAN_PRONUNCIATION_ERROR_SCORE = 90.8
export const SPEAKER_BIAS_MEAN_SPEAKER_DELTA_SCORE = 11.4
export const SPEAKER_BIAS_MEAN_ERROR_DELTA_SCORE = 9.2
export const SPEAKER_BIAS_SPEAKER_TO_ERROR_SCORE_RATIO = 1.23
export const SPEAKER_BIAS_MEAN_SPEAKER_DELTA_MFCC_DISTANCE = 3.24
export const SPEAKER_BIAS_MEAN_ERROR_DELTA_MFCC_DISTANCE = 3.0
/**
 * Locutor ≳ error on our score → conversation 0–100 would grade timbre.
 * The 0–100 stays in drill (#68).
 */
export const SPEAKER_BIAS_PRODUCT_POLICY: SpeakerBiasProductPolicy = 'drill-only'

export function conversationPronunciationScoreIsEnabled(
  policy: SpeakerBiasProductPolicy = SPEAKER_BIAS_PRODUCT_POLICY,
): boolean {
  return policy === 'keep-conversation-score'
}
