import { describe, expect, it } from 'vitest'
import { scoreFormantMediansFromMonoPcm } from './score-formant-distance'
import { SYNTHETIC_VOICE_SAMPLE_RATE_HZ, synthesizeVoicedPhrase } from './synthetic-voiced-phrase'

describe('scoreFormantMediansFromMonoPcm', () => {
  it('returns null for empty or unvoiced buffers', () => {
    expect(
      scoreFormantMediansFromMonoPcm(
        new Float32Array(0),
        new Float32Array(1600),
        SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
      ),
    ).toBeNull()
    expect(
      scoreFormantMediansFromMonoPcm(
        new Float32Array(1600),
        new Float32Array(1600),
        SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
      ),
    ).toBeNull()
  })

  it('scores the same synthetic vowel highly even at another F0', () => {
    const reference = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: 160,
      vowelIds: ['a', 'a', 'a'],
      vowelDurationSeconds: 0.3,
    })
    const user = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: 180,
      vowelIds: ['a', 'a', 'a'],
      vowelDurationSeconds: 0.3,
    })
    const result = scoreFormantMediansFromMonoPcm(
      user,
      reference,
      SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
    )
    expect(result).not.toBeNull()
    expect(result!.score0to100).toBeGreaterThan(70)
  })

  it('scores a different vowel identity lower than a matching one', () => {
    const reference = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: 200,
      vowelIds: ['a', 'a', 'a'],
      vowelDurationSeconds: 0.3,
    })
    const matching = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: 200,
      vowelIds: ['a', 'a', 'a'],
      vowelDurationSeconds: 0.3,
    })
    const mismatch = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: 200,
      vowelIds: ['i', 'i', 'i'],
      vowelDurationSeconds: 0.3,
    })
    const match = scoreFormantMediansFromMonoPcm(
      matching,
      reference,
      SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
    )
    const different = scoreFormantMediansFromMonoPcm(
      mismatch,
      reference,
      SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
    )
    expect(match).not.toBeNull()
    expect(different).not.toBeNull()
    expect(match!.score0to100).toBeGreaterThan(different!.score0to100)
  })
})
