import { describe, expect, it } from 'vitest'
import {
  SPEAKER_BIAS_PHRASE_VOWELS,
  SPEAKER_BIAS_SPEAKER_A_F0_HZ,
  SPEAKER_BIAS_SPEAKER_B_F0_HZ,
  measureSpeakerBiasOnPronunciationScore,
  resolveSpeakerBiasProductPolicy,
} from './measure-speaker-bias'
import {
  computeMeanVoicedPitchInHertz,
  extractPitchContourWithYin,
} from './pitch-detection-yin'
import {
  SPEAKER_BIAS_MEAN_ERROR_DELTA_SCORE,
  SPEAKER_BIAS_MEAN_PRONUNCIATION_ERROR_SCORE,
  SPEAKER_BIAS_MEAN_SPEAKER_CHANGE_SCORE,
  SPEAKER_BIAS_MEAN_SPEAKER_DELTA_SCORE,
  SPEAKER_BIAS_PRODUCT_POLICY,
  SPEAKER_BIAS_SPEAKER_TO_ERROR_SCORE_RATIO,
} from './speaker-bias-invariants'
import {
  SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
  synthesizeVoicedPhrase,
} from './synthetic-voiced-phrase'

describe('synthesizeVoicedPhrase', () => {
  it('is voiced near the requested F0 for both speaker profiles', () => {
    const speakerA = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: SPEAKER_BIAS_SPEAKER_A_F0_HZ,
      vowelIds: ['a', 'i', 'u'],
    })
    const speakerB = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: SPEAKER_BIAS_SPEAKER_B_F0_HZ,
      vowelIds: ['a', 'i', 'u'],
    })
    const pitchA = computeMeanVoicedPitchInHertz(
      extractPitchContourWithYin(speakerA, SYNTHETIC_VOICE_SAMPLE_RATE_HZ),
    )
    const pitchB = computeMeanVoicedPitchInHertz(
      extractPitchContourWithYin(speakerB, SYNTHETIC_VOICE_SAMPLE_RATE_HZ),
    )
    expect(speakerA.length).toBeGreaterThan(2000)
    expect(pitchA).toBeCloseTo(SPEAKER_BIAS_SPEAKER_A_F0_HZ, -1)
    expect(pitchB).toBeCloseTo(SPEAKER_BIAS_SPEAKER_B_F0_HZ, -1)
  })
})

describe('measureSpeakerBiasOnPronunciationScore', () => {
  const measurement = measureSpeakerBiasOnPronunciationScore()

  it('scores three same-content phrases through scorePronunciationFromMonoPcm', () => {
    expect(SPEAKER_BIAS_PHRASE_VOWELS).toHaveLength(3)
    expect(measurement.pairCount).toBe(3)
    expect(measurement.meanSameSpeakerScore).toBe(100)
  })

  it('publishes numeric speaker vs error deltas and the drill-only policy', () => {
    expect(measurement.meanSpeakerChangeScore).toBeCloseTo(
      SPEAKER_BIAS_MEAN_SPEAKER_CHANGE_SCORE,
      0,
    )
    expect(measurement.meanPronunciationErrorScore).toBeCloseTo(
      SPEAKER_BIAS_MEAN_PRONUNCIATION_ERROR_SCORE,
      0,
    )
    expect(measurement.meanSpeakerDeltaScore).toBeCloseTo(SPEAKER_BIAS_MEAN_SPEAKER_DELTA_SCORE, 0)
    expect(measurement.meanErrorDeltaScore).toBeCloseTo(SPEAKER_BIAS_MEAN_ERROR_DELTA_SCORE, 0)
    expect(measurement.speakerToErrorScoreRatio).toBeCloseTo(
      SPEAKER_BIAS_SPEAKER_TO_ERROR_SCORE_RATIO,
      1,
    )
    expect(measurement.meanSpeakerDeltaScore).toBeGreaterThan(measurement.meanErrorDeltaScore)
    expect(measurement.policy).toBe('drill-only')
    expect(SPEAKER_BIAS_PRODUCT_POLICY).toBe('drill-only')
    expect(resolveSpeakerBiasProductPolicy({ speakerToErrorScoreRatio: 0.2 })).toBe(
      'keep-conversation-score',
    )
    expect(resolveSpeakerBiasProductPolicy({ speakerToErrorScoreRatio: 0.8 })).toBe(
      'conversation-score-secondary',
    )
    expect(resolveSpeakerBiasProductPolicy({ speakerToErrorScoreRatio: 1.4 })).toBe('drill-only')
  })
})
