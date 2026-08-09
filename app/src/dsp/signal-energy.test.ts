import { describe, expect, it } from 'vitest'
import {
  computePeakAmplitude,
  computeRootMeanSquareEnergy,
  hasUsableSpeechEnergy,
  MINIMUM_CAPTURE_ENERGY_RMS,
  MINIMUM_CAPTURE_PEAK,
  sanitizeNonFiniteSamples,
} from './signal-energy'
describe('computeRootMeanSquareEnergy', () => {
  it('returns 0 for absolute silence', () => {
    expect(computeRootMeanSquareEnergy(new Float32Array(512))).toBe(0)
  })
  it('returns 0 for an empty sample array', () => {
    expect(computeRootMeanSquareEnergy(new Float32Array(0))).toBe(0)
  })
  it('returns the amplitude itself for a constant signal', () => {
    const constantAmplitude = 0.5
    const constantSamples = new Float32Array(256).fill(constantAmplitude)
    expect(computeRootMeanSquareEnergy(constantSamples)).toBeCloseTo(constantAmplitude, 10)
  })
  it('returns amplitude / sqrt(2) for a pure sine wave', () => {
    const sampleCount = 4800
    const amplitude = 1
    const frequencyInHertz = 440
    const sampleRateInHertz = 48000
    const sineWaveSamples = new Float32Array(sampleCount)
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const timeInSeconds = sampleIndex / sampleRateInHertz
      sineWaveSamples[sampleIndex] =
        amplitude * Math.sin(2 * Math.PI * frequencyInHertz * timeInSeconds)
    }
    expect(computeRootMeanSquareEnergy(sineWaveSamples)).toBeCloseTo(amplitude / Math.sqrt(2), 2)
  })
  it('ignores a NaN sample instead of poisoning the whole result', () => {
    const samples = new Float32Array([0.5, 0.5, 0.5, 0.5])
    samples[1] = NaN
    const expectedRms = Math.sqrt((0.25 + 0 + 0.25 + 0.25) / 4)
    expect(computeRootMeanSquareEnergy(samples)).toBeCloseTo(expectedRms, 10)
    expect(Number.isFinite(computeRootMeanSquareEnergy(samples))).toBe(true)
  })
  it('ignores an Infinity sample instead of reporting infinite energy', () => {
    const samples = new Float32Array([0.1, 0.1, 0.1])
    samples[0] = Infinity
    expect(Number.isFinite(computeRootMeanSquareEnergy(samples))).toBe(true)
    expect(computeRootMeanSquareEnergy(samples)).toBeLessThan(1)
  })
})
describe('computePeakAmplitude', () => {
  it('returns the max absolute sample', () => {
    expect(computePeakAmplitude(new Float32Array([0.1, -0.4, 0.2]))).toBeCloseTo(0.4, 5)
  })
  it('ignores NaN samples when finding the peak', () => {
    const samples = new Float32Array([0.1, NaN, 0.3])
    expect(computePeakAmplitude(samples)).toBeCloseTo(0.3, 5)
  })
  it('ignores Infinity samples instead of reporting an infinite peak', () => {
    const samples = new Float32Array([0.1, Infinity, 0.3])
    expect(Number.isFinite(computePeakAmplitude(samples))).toBe(true)
    expect(computePeakAmplitude(samples)).toBeCloseTo(0.3, 5)
  })
})
describe('sanitizeNonFiniteSamples', () => {
  it('replaces NaN, Infinity, and -Infinity with silence', () => {
    const samples = new Float32Array([0.2, NaN, Infinity, -Infinity, -0.3])
    const sanitized = sanitizeNonFiniteSamples(samples)
    expect(sanitized).toEqual(new Float32Array([0.2, 0, 0, 0, -0.3]))
  })
  it('leaves an already-clean signal untouched in value', () => {
    const samples = new Float32Array([0.1, -0.2, 0.3])
    expect(sanitizeNonFiniteSamples(samples)).toEqual(new Float32Array([0.1, -0.2, 0.3]))
  })
  it('preserves length for an empty array', () => {
    expect(sanitizeNonFiniteSamples(new Float32Array(0)).length).toBe(0)
  })
})
describe('hasUsableSpeechEnergy', () => {
  it('returns false for empty samples', () => {
    expect(hasUsableSpeechEnergy(new Float32Array(0))).toBe(false)
  })
  it('returns false for silence', () => {
    expect(hasUsableSpeechEnergy(new Float32Array(16000), 16000)).toBe(false)
  })
  it('returns false when the utterance is too short even if loud', () => {
    const loudButShort = new Float32Array(100).fill(0.5)
    expect(hasUsableSpeechEnergy(loudButShort, 16000)).toBe(false)
  })
  it('returns false for low noise that would formerly pass a tiny RMS gate', () => {
    const hiss = new Float32Array(16000).fill(0.001)
    expect(computeRootMeanSquareEnergy(hiss)).toBeLessThan(MINIMUM_CAPTURE_ENERGY_RMS)
    expect(hasUsableSpeechEnergy(hiss, 16000)).toBe(false)
  })
  it('returns true for a long enough speech-like level signal', () => {
    const speechLike = new Float32Array(16000).fill(0.1)
    expect(computeRootMeanSquareEnergy(speechLike)).toBeGreaterThanOrEqual(MINIMUM_CAPTURE_ENERGY_RMS)
    expect(computePeakAmplitude(speechLike)).toBeGreaterThanOrEqual(MINIMUM_CAPTURE_PEAK)
    expect(hasUsableSpeechEnergy(speechLike, 16000)).toBe(true)
  })
  it('honors custom thresholds', () => {
    const samples = new Float32Array(16000).fill(0.01)
    expect(hasUsableSpeechEnergy(samples, 16000, { minimumRms: 0.05, minimumPeak: 0.05 })).toBe(
      false,
    )
    expect(hasUsableSpeechEnergy(samples, 16000, { minimumRms: 0.005, minimumPeak: 0.005 })).toBe(
      true,
    )
  })
  it('does not let a single Infinity sample falsely pass the gate on an otherwise-quiet capture', () => {
    const samples = new Float32Array(16000).fill(0.0005)
    samples[100] = Infinity
    expect(hasUsableSpeechEnergy(samples, 16000)).toBe(false)
  })
})
