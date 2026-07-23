import { describe, expect, it } from 'vitest'

/**
 * Canvas animation is DOM-bound; keep a tiny pure check so the suite stays green.
 * Meters math is covered via dsp/signal-energy tests.
 */
describe('waveform-canvas module', () => {
  it('exports animation entry points as functions', async () => {
    const mod = await import('./waveform-canvas')
    expect(typeof mod.startAnalyserWaveformAnimation).toBe('function')
    expect(typeof mod.clearWaveformCanvas).toBe('function')
  })
})
