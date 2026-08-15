/**
 * Issue #95: measure speaker-change vs pronunciation-error on *our* score.
 * Synthetic voiced phrases only — no recorded speech in the repo.
 */

import type { SpeakerBiasProductPolicy } from './speaker-bias-invariants'
import { CALIBRATION_SPEAKER_PROFILES } from './pronunciation-score-calibration-protocol'
import {
  scorePronunciationFromMonoPcm,
  type PronunciationScoreResult,
} from './pronunciation-score'
import {
  SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
  synthesizeVoicedPhrase,
  type SyntheticVowelId,
} from './synthetic-voiced-phrase'

/** Same-content tracks (stand-ins for “the same phrase”). */
export const SPEAKER_BIAS_PHRASE_VOWELS: readonly (readonly SyntheticVowelId[])[] = [
  ['a', 'i', 'u'],
  ['a', 'a', 'a'],
  ['i', 'u', 'a'],
]

/** Same F0, different vowels — documented pronunciation error. */
export const SPEAKER_BIAS_ERROR_VOWELS: readonly (readonly SyntheticVowelId[])[] = [
  ['i', 'i', 'i'],
  ['u', 'u', 'u'],
  ['u', 'a', 'i'],
]

export const SPEAKER_BIAS_SPEAKER_A_F0_HZ =
  CALIBRATION_SPEAKER_PROFILES[0].baseFrequencyInHertz
export const SPEAKER_BIAS_SPEAKER_B_F0_HZ =
  CALIBRATION_SPEAKER_PROFILES[1].baseFrequencyInHertz

/**
 * Keep conversation 0–100 only when a speaker change moves the score
 * less than half as much as a vowel error (locutor ≪ error).
 */
export const SPEAKER_BIAS_KEEP_CONVERSATION_MAX_RATIO = 0.5

export type { SpeakerBiasProductPolicy } from './speaker-bias-invariants'

export interface SpeakerBiasPairResult {
  readonly phraseIndex: number
  readonly sameSpeakerScore: number
  readonly speakerChangeScore: number
  readonly pronunciationErrorScore: number
  readonly sameSpeakerMfccDistance: number
  readonly speakerChangeMfccDistance: number
  readonly pronunciationErrorMfccDistance: number
}

export interface SpeakerBiasMeasurement {
  readonly pairCount: number
  readonly meanSameSpeakerScore: number
  readonly meanSpeakerChangeScore: number
  readonly meanPronunciationErrorScore: number
  readonly meanSpeakerDeltaScore: number
  readonly meanErrorDeltaScore: number
  readonly speakerToErrorScoreRatio: number
  readonly meanSameSpeakerMfccDistance: number
  readonly meanSpeakerChangeMfccDistance: number
  readonly meanPronunciationErrorMfccDistance: number
  readonly meanSpeakerDeltaMfccDistance: number
  readonly meanErrorDeltaMfccDistance: number
  readonly policy: SpeakerBiasProductPolicy
  readonly pairs: readonly SpeakerBiasPairResult[]
}

export function measureSpeakerBiasOnPronunciationScore(): SpeakerBiasMeasurement {
  const pairs: SpeakerBiasPairResult[] = []
  for (let phraseIndex = 0; phraseIndex < SPEAKER_BIAS_PHRASE_VOWELS.length; phraseIndex += 1) {
    const pair = scoreBiasPair(phraseIndex)
    if (pair) {
      pairs.push(pair)
    }
  }
  if (pairs.length === 0) {
    throw new Error('Speaker-bias protocol produced no usable score pairs.')
  }
  return summarizeSpeakerBiasPairs(pairs)
}

export function resolveSpeakerBiasProductPolicy(input: {
  readonly speakerToErrorScoreRatio: number
}): SpeakerBiasProductPolicy {
  if (input.speakerToErrorScoreRatio <= SPEAKER_BIAS_KEEP_CONVERSATION_MAX_RATIO) {
    return 'keep-conversation-score'
  }
  if (input.speakerToErrorScoreRatio <= 1) {
    return 'conversation-score-secondary'
  }
  return 'drill-only'
}

function scoreBiasPair(phraseIndex: number): SpeakerBiasPairResult | null {
  const content = SPEAKER_BIAS_PHRASE_VOWELS[phraseIndex]
  const errorVowels = SPEAKER_BIAS_ERROR_VOWELS[phraseIndex]
  if (!content || !errorVowels) {
    return null
  }
  const reference = phrase(content, SPEAKER_BIAS_SPEAKER_A_F0_HZ)
  const sameSpeaker = scorePair(reference, reference)
  const speakerChange = scorePair(phrase(content, SPEAKER_BIAS_SPEAKER_B_F0_HZ), reference)
  const pronunciationError = scorePair(phrase(errorVowels, SPEAKER_BIAS_SPEAKER_A_F0_HZ), reference)
  if (!sameSpeaker || !speakerChange || !pronunciationError) {
    return null
  }
  return {
    phraseIndex,
    sameSpeakerScore: sameSpeaker.score0to100,
    speakerChangeScore: speakerChange.score0to100,
    pronunciationErrorScore: pronunciationError.score0to100,
    sameSpeakerMfccDistance: sameSpeaker.mfccNormalizedDistance,
    speakerChangeMfccDistance: speakerChange.mfccNormalizedDistance,
    pronunciationErrorMfccDistance: pronunciationError.mfccNormalizedDistance,
  }
}

function phrase(vowelIds: readonly SyntheticVowelId[], f0: number): Float32Array {
  return synthesizeVoicedPhrase({
    fundamentalFrequencyInHertz: f0,
    vowelIds,
    sampleRateInHertz: SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
  })
}

function scorePair(
  user: Float32Array,
  reference: Float32Array,
): PronunciationScoreResult | null {
  return scorePronunciationFromMonoPcm(user, reference, SYNTHETIC_VOICE_SAMPLE_RATE_HZ)
}

function summarizeSpeakerBiasPairs(pairs: readonly SpeakerBiasPairResult[]): SpeakerBiasMeasurement {
  const meanSameSpeakerScore = mean(pairs.map((pair) => pair.sameSpeakerScore))
  const meanSpeakerChangeScore = mean(pairs.map((pair) => pair.speakerChangeScore))
  const meanPronunciationErrorScore = mean(pairs.map((pair) => pair.pronunciationErrorScore))
  const meanSpeakerDeltaScore = meanSameSpeakerScore - meanSpeakerChangeScore
  const meanErrorDeltaScore = meanSameSpeakerScore - meanPronunciationErrorScore
  const speakerToErrorScoreRatio =
    meanErrorDeltaScore <= 1e-6 ? Number.POSITIVE_INFINITY : meanSpeakerDeltaScore / meanErrorDeltaScore
  const meanSameSpeakerMfccDistance = mean(pairs.map((pair) => pair.sameSpeakerMfccDistance))
  const meanSpeakerChangeMfccDistance = mean(pairs.map((pair) => pair.speakerChangeMfccDistance))
  const meanPronunciationErrorMfccDistance = mean(
    pairs.map((pair) => pair.pronunciationErrorMfccDistance),
  )
  const policy = resolveSpeakerBiasProductPolicy({ speakerToErrorScoreRatio })
  return {
    pairCount: pairs.length,
    meanSameSpeakerScore,
    meanSpeakerChangeScore,
    meanPronunciationErrorScore,
    meanSpeakerDeltaScore,
    meanErrorDeltaScore,
    speakerToErrorScoreRatio,
    meanSameSpeakerMfccDistance,
    meanSpeakerChangeMfccDistance,
    meanPronunciationErrorMfccDistance,
    meanSpeakerDeltaMfccDistance: meanSpeakerChangeMfccDistance - meanSameSpeakerMfccDistance,
    meanErrorDeltaMfccDistance: meanPronunciationErrorMfccDistance - meanSameSpeakerMfccDistance,
    policy,
    pairs,
  }
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
