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
    // Peak 0.05 is above the speech floor; gain to 0.7 would be 14x, capped at 6x.
    const quiet = new Float32Array([0.05, -0.04, 0.03])
    const normalized = normalizePeakAmplitude(quiet, 0.7)
    const peak = Math.max(...Array.from(normalized).map(Math.abs))
    expect(peak).toBeCloseTo(0.05 * MAXIMUM_NORMALIZATION_GAIN, 5)
  })

  it('does not amplify an already loud signal', () => {
    const loud = new Float32Array([0.9, -0.8, 0.5])
    const normalized = normalizePeakAmplitude(loud, 0.7)
    expect(Math.max(...Array.from(normalized).map(Math.abs))).toBeCloseTo(0.9, 5)
  })

  it('does not boost noise-floor peaks below the speech threshold', () => {
    const noiseFloor = new Float32Array([0.01, -0.008, 0.005])
    expect(Math.max(...Array.from(noiseFloor).map(Math.abs))).toBeLessThan(
      MINIMUM_PEAK_FOR_NORMALIZATION,
    )
    const normalized = normalizePeakAmplitude(noiseFloor, 0.7)
    expect(Math.max(...Array.from(normalized).map(Math.abs))).toBeCloseTo(0.01, 5)
  })
})
