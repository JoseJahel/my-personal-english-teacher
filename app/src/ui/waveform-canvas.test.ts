import { describe, expect, it } from 'vitest'
import {
  WAVEFORM_BACKGROUND_COLOR,
  WAVEFORM_CENTER_LINE_COLOR,
  WAVEFORM_LINE_COLOR,
} from './waveform-canvas'

/**
 * Canvas animation is DOM-bound; keep a tiny pure check so the suite stays green.
 * Meters math is covered via dsp/signal-energy tests.
 */
// Freeze-guard: pins the literal hex values drawn on the canvas so an accidental
// edit doesn't silently change them. These are kept in sync with the sage tokens
// in index.css by convention only — this test does not verify that sync.
describe('waveform-canvas module', () => {
  it('exports animation entry points as functions', async () => {
    const mod = await import('./waveform-canvas')
    expect(typeof mod.startAnalyserWaveformAnimation).toBe('function')
    expect(typeof mod.clearWaveformCanvas).toBe('function')
  })

  it('pins the waveform canvas colors to their current values', () => {
    expect(WAVEFORM_BACKGROUND_COLOR).toBe('#2e3b30')
    expect(WAVEFORM_LINE_COLOR).toBe('#8fbf95')
    expect(WAVEFORM_CENTER_LINE_COLOR).toBe('#4a5c4d')
  })
})
