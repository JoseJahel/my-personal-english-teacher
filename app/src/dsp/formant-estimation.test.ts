import { describe, expect, it } from 'vitest'
import { createHannWindow } from './mfcc-extraction'
import {
  computeMedianFormants,
  estimateFormantsInFrame,
  extractFormantContour,
  levinsonDurbinLpc,
  pickSpectralPeaksInHertz,
} from './formant-estimation'

describe('levinsonDurbinLpc', () => {
  it('returns null for degenerate autocorrelation', () => {
    expect(levinsonDurbinLpc(new Float32Array([0, 0, 0]), 2)).toBeNull()
  })

  it('produces finite coefficients for a valid autocorrelation', () => {
    // r of a short decaying process
    const r = new Float32Array([1, 0.5, 0.2, 0.05, 0.01])
    const a = levinsonDurbinLpc(r, 4)
    expect(a).not.toBeNull()
    expect(a!).toHaveLength(4)
    for (const coefficient of a!) {
      expect(Number.isFinite(coefficient)).toBe(true)
    }
  })
})

describe('pickSpectralPeaksInHertz', () => {
  it('finds two synthetic peaks near the planted frequencies', () => {
    const binCount = 513
    const sampleRate = 16000
    const nyquist = sampleRate / 2
    const envelope = new Float32Array(binCount)
    // Plant peaks near 500 Hz and 1500 Hz
    const bin500 = Math.round((500 / nyquist) * (binCount - 1))
    const bin1500 = Math.round((1500 / nyquist) * (binCount - 1))
    for (let bin = 0; bin < binCount; bin += 1) {
      envelope[bin] = 0
    }
    envelope[bin500] = 10
    envelope[bin500 - 1] = 5
    envelope[bin500 + 1] = 5
    envelope[bin1500] = 9
    envelope[bin1500 - 1] = 4
    envelope[bin1500 + 1] = 4

    const peaks = pickSpectralPeaksInHertz(envelope, sampleRate, {
      minimumFrequencyInHertz: 90,
      maximumFrequencyInHertz: 4000,
      minimumPeakSeparationInHertz: 250,
      maxPeaks: 3,
    })
    expect(peaks.length).toBeGreaterThanOrEqual(2)
    expect(peaks[0]!).toBeGreaterThan(400)
    expect(peaks[0]!).toBeLessThan(600)
    expect(peaks[1]!).toBeGreaterThan(1300)
    expect(peaks[1]!).toBeLessThan(1700)
  })
})

describe('estimateFormantsInFrame / extractFormantContour', () => {
  it('returns empty formants for silence', () => {
    const silence = new Float32Array(480)
    const window = createHannWindow(silence.length)
    const formants = estimateFormantsInFrame(silence, window, 16000, {
      lpcOrder: 12,
      minimumFrequencyInHertz: 90,
      maximumFrequencyInHertz: 4000,
      minimumPeakSeparationInHertz: 250,
      spectrumBinCount: 256,
    })
    expect(formants.f1InHertz).toBeNull()
  })

  it('builds a non-empty contour for sustained voiced-like energy', () => {
    // Impulse train through a simple resonator-like recursion (all-pole-ish energy).
    const sampleRate = 16000
    const samples = new Float32Array(sampleRate * 0.4)
    let y1 = 0
    let y2 = 0
    // Poles near ~600 Hz and mild damping — LPC should often recover a low formant.
    const r = 0.95
    const theta = (2 * Math.PI * 600) / sampleRate
    const a1 = -2 * r * Math.cos(theta)
    const a2 = r * r
    for (let index = 0; index < samples.length; index += 1) {
      const excitation = index % Math.round(sampleRate / 120) === 0 ? 1 : 0
      const y = excitation - a1 * y1 - a2 * y2
      samples[index] = y * 0.15
      y2 = y1
      y1 = y
    }

    const contour = extractFormantContour(samples, sampleRate)
    expect(contour.length).toBeGreaterThan(15)
    const median = computeMedianFormants(contour)
    // At least F1 should appear for this resonant source on many frames.
    expect(median.f1InHertz).not.toBeNull()
    expect(median.f1InHertz!).toBeGreaterThan(200)
    expect(median.f1InHertz!).toBeLessThan(1200)
  })
})
