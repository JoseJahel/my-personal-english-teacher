import { describe, expect, it } from 'vitest'
import { SIGNAL_CANVAS_BACKGROUND, spectrogramHeatColor } from './utterance-signal-canvas'

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

describe('SIGNAL_CANVAS_BACKGROUND', () => {
  it('matches the sage-900 token (same dark green as the waveform canvas)', () => {
    expect(SIGNAL_CANVAS_BACKGROUND).toBe('#2e3b30')
  })
})
