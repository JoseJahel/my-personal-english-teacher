import { describe, expect, it } from 'vitest'
import { scorePronunciationFromMonoPcm } from './pronunciation-score'
import { SYNTHETIC_VOICE_SAMPLE_RATE_HZ, synthesizeVoicedPhrase } from './synthetic-voiced-phrase'

function synthesizeSineWave(options: {
  frequencyInHertz: number
  sampleRateInHertz: number
  durationSeconds: number
  amplitude?: number
}): Float32Array {
  const { frequencyInHertz, sampleRateInHertz, durationSeconds, amplitude = 0.45 } = options
  const sampleCount = Math.floor(durationSeconds * sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] =
      amplitude * Math.sin((2 * Math.PI * frequencyInHertz * index) / sampleRateInHertz)
  }
  return samples
}

describe('scorePronunciationFromMonoPcm', () => {
  const sampleRateInHertz = 16000

  it('returns null for empty inputs', () => {
    expect(
      scorePronunciationFromMonoPcm(new Float32Array(0), new Float32Array(1000), sampleRateInHertz),
    ).toBeNull()
  })

  it('scores a time-stretched copy of the same tone highly', () => {
    const reference = synthesizeSineWave({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.25,
    })
    const user = synthesizeSineWave({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.35,
    })
    const result = scorePronunciationFromMonoPcm(user, reference, sampleRateInHertz)
    expect(result).not.toBeNull()
    expect(result!.score0to100).toBeGreaterThan(70)
    expect(result!.userMfccFrameCount).toBeGreaterThan(5)
    expect(result!.dtwPathLength).toBeGreaterThan(5)
  })

  it('scores a different tone lower than a matching tone', () => {
    const reference = synthesizeSineWave({
      frequencyInHertz: 160,
      sampleRateInHertz,
      durationSeconds: 0.28,
    })
    const matchingUser = synthesizeSineWave({
      frequencyInHertz: 160,
      sampleRateInHertz,
      durationSeconds: 0.32,
    })
    const mismatchUser = synthesizeSineWave({
      frequencyInHertz: 320,
      sampleRateInHertz,
      durationSeconds: 0.28,
    })

    const match = scorePronunciationFromMonoPcm(matchingUser, reference, sampleRateInHertz)
    const mismatch = scorePronunciationFromMonoPcm(mismatchUser, reference, sampleRateInHertz)
    expect(match).not.toBeNull()
    expect(mismatch).not.toBeNull()
    expect(match!.score0to100).toBeGreaterThan(mismatch!.score0to100)
  })

  it('supports MFCC-only mode', () => {
    const tone = synthesizeSineWave({
      frequencyInHertz: 200,
      sampleRateInHertz,
      durationSeconds: 0.25,
    })
    const result = scorePronunciationFromMonoPcm(tone, tone, sampleRateInHertz, {
      includePitch: false,
      includeEnergy: false,
      includeFormants: false,
    })
    expect(result).not.toBeNull()
    expect(result!.pitchScore0to100).toBeNull()
    expect(result!.energyScore0to100).toBeNull()
    expect(result!.formantScore0to100).toBeNull()
    expect(result!.score0to100).toBe(result!.mfccScore0to100)
    expect(result!.score0to100).toBeGreaterThan(85)
  })

  it('attaches word highlights when reference text is provided', () => {
    const tone = synthesizeSineWave({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.3,
    })
    const result = scorePronunciationFromMonoPcm(tone, tone, sampleRateInHertz, {
      includePitch: false,
      referenceTextForHighlights: 'hello world',
    })
    expect(result).not.toBeNull()
    expect(result!.wordHighlights).toHaveLength(2)
    expect(result!.wordHighlights[0]!.word).toBe('hello')
    expect(result!.wordHighlights[1]!.word).toBe('world')
  })

  it('exposes an energy branch for constant-envelope tones', () => {
    const reference = synthesizeSineWave({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.28,
    })
    const user = synthesizeSineWave({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.32,
      amplitude: 0.3,
    })
    const result = scorePronunciationFromMonoPcm(user, reference, sampleRateInHertz, {
      includePitch: false,
      includeFormants: false,
    })
    expect(result).not.toBeNull()
    expect(result!.energyScore0to100).not.toBeNull()
    expect(result!.energyScore0to100!).toBeGreaterThan(70)
    expect(result!.score0to100).not.toBe(result!.mfccScore0to100)
  })

  it('exposes a formant branch for recoverable synthetic vowels', () => {
    const reference = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: 180,
      vowelIds: ['a', 'a', 'a'],
      vowelDurationSeconds: 0.3,
    })
    const user = synthesizeVoicedPhrase({
      fundamentalFrequencyInHertz: 180,
      vowelIds: ['a', 'a', 'a'],
      vowelDurationSeconds: 0.3,
    })
    const result = scorePronunciationFromMonoPcm(
      user,
      reference,
      SYNTHETIC_VOICE_SAMPLE_RATE_HZ,
      { includePitch: false, includeEnergy: false },
    )
    expect(result).not.toBeNull()
    expect(result!.formantScore0to100).not.toBeNull()
    expect(result!.formantScore0to100!).toBeGreaterThan(70)
  })
})
