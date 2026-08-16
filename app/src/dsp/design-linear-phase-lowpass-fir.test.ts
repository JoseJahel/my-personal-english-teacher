import { describe, expect, it } from 'vitest'
import {
  designHannWindowedSincLowpass,
  linearPhaseGroupDelayInSamples,
  normalizedSinc,
} from './design-linear-phase-lowpass-fir'

describe('normalizedSinc', () => {
  it('is 1 at zero and even-symmetric around zero', () => {
    expect(normalizedSinc(0)).toBe(1)
    expect(normalizedSinc(1)).toBeCloseTo(0, 10)
    expect(normalizedSinc(0.5)).toBeCloseTo(normalizedSinc(-0.5), 10)
  })
})

describe('designHannWindowedSincLowpass', () => {
  it('returns a symmetric kernel (linear phase) with the requested DC gain', () => {
    const taps = designHannWindowedSincLowpass({
      tapCount: 93,
      cutoffFrequencyInHertz: 7200,
      sampleRateInHertz: 48000,
      dcGain: 1,
    })
    expect(taps.length).toBe(93)
    expect(linearPhaseGroupDelayInSamples(93)).toBe(46)
    let sum = 0
    for (let index = 0; index < taps.length; index += 1) {
      sum += taps[index] ?? 0
      expect(taps[index] ?? 0).toBeCloseTo(taps[taps.length - 1 - index] ?? 0, 6)
    }
    expect(sum).toBeCloseTo(1, 5)
  })

  it('scales an interpolator prototype to gain L, not to 1', () => {
    const taps = designHannWindowedSincLowpass({
      tapCount: 33,
      cutoffFrequencyInHertz: 7200,
      sampleRateInHertz: 44100 * 160,
      dcGain: 160,
    })
    let sum = 0
    for (const tap of taps) {
      sum += tap
    }
    expect(sum).toBeCloseTo(160, 3)
  })

  it('does not throw when the cutoff cannot be realised', () => {
    const taps = designHannWindowedSincLowpass({
      tapCount: 5,
      cutoffFrequencyInHertz: 20000,
      sampleRateInHertz: 16000,
      dcGain: 2,
    })
    expect(taps[2]).toBeCloseTo(2, 5)
  })
})
