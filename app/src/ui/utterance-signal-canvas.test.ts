import { describe, expect, it } from 'vitest'
import { spectrogramHeatColor } from './utterance-signal-canvas'

describe('spectrogramHeatColor', () => {
  it('returns valid rgb() strings across the range', () => {
    for (const intensity of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      expect(spectrogramHeatColor(intensity)).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
    }
  })

  it('clamps out-of-range intensities', () => {
    expect(spectrogramHeatColor(-1)).toBe(spectrogramHeatColor(0))
    expect(spectrogramHeatColor(2)).toBe(spectrogramHeatColor(1))
  })
})
