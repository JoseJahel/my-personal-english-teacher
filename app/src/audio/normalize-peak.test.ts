import { describe, expect, it } from 'vitest'
import {
  MAXIMUM_NORMALIZATION_GAIN,
  MINIMUM_PEAK_FOR_NORMALIZATION,
  normalizePeakAmplitude,
} from './normalize-peak'
describe('normalizePeakAmplitude', () => {
  it('returns empty for empty input', () => {
    expect(normalizePeakAmplitude(new Float32Array(0)).length).toBe(0)
  })
  it('boosts a moderately quiet speech-like signal with capped gain', () => {
    const quiet = new Float32Array([0.05, -0.04, 0.03])
    const normalized = normalizePeakAmplitude(quiet, 0.85)
    const peak = Math.max(...Array.from(normalized).map(Math.abs))
    expect(peak).toBeCloseTo(0.05 * MAXIMUM_NORMALIZATION_GAIN, 5)
  })
  it('does not amplify an already loud signal', () => {
    const loud = new Float32Array([0.9, -0.8, 0.5])
    const normalized = normalizePeakAmplitude(loud, 0.85)
    expect(Math.max(...Array.from(normalized).map(Math.abs))).toBeCloseTo(0.9, 5)
  })
  it('does not boost noise-floor peaks below the speech threshold', () => {
    const noiseFloor = new Float32Array([0.005, -0.004, 0.003])
    expect(Math.max(...Array.from(noiseFloor).map(Math.abs))).toBeLessThan(
      MINIMUM_PEAK_FOR_NORMALIZATION,
    )
    const normalized = normalizePeakAmplitude(noiseFloor, 0.85)
    expect(Math.max(...Array.from(normalized).map(Math.abs))).toBeCloseTo(0.005, 5)
  })
  it('boosts quiet but speech-like peaks above the lowered floor', () => {
    const quietSpeech = new Float32Array([0.02, -0.018, 0.015])
    const normalized = normalizePeakAmplitude(quietSpeech, 0.85)
    const peak = Math.max(...Array.from(normalized).map(Math.abs))
    expect(peak).toBeGreaterThan(0.15)
  })
  it('ignores an Infinity sample when measuring the peak, avoiding an infinite gain calculation', () => {
    const samples = new Float32Array([0.05, Infinity, 0.04])
    const normalized = normalizePeakAmplitude(samples, 0.85)
    expect(normalized.every((value) => Number.isFinite(value))).toBe(true)
  })
  it('writes corrupted samples out as silence instead of amplified NaN/Infinity', () => {
    const samples = new Float32Array([0.05, NaN, 0.04])
    const normalized = normalizePeakAmplitude(samples, 0.85)
    expect(Number.isFinite(normalized[1])).toBe(true)
    expect(normalized[1]).toBe(0)
  })
})
