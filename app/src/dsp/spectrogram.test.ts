import { describe, expect, it } from 'vitest'
import {
  computeLogMagnitudeSpectrogram,
  computeSpectrogramValueRange,
} from './spectrogram'

function synthesizeSineWave(options: {
  frequencyInHertz: number
  sampleRateInHertz: number
  durationSeconds: number
}): Float32Array {
  const { frequencyInHertz, sampleRateInHertz, durationSeconds } = options
  const sampleCount = Math.floor(durationSeconds * sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = 0.5 * Math.sin((2 * Math.PI * frequencyInHertz * index) / sampleRateInHertz)
  }
  return samples
}

describe('computeLogMagnitudeSpectrogram', () => {
  const sampleRateInHertz = 16000

  it('returns empty frames for empty audio', () => {
    const result = computeLogMagnitudeSpectrogram(new Float32Array(0), sampleRateInHertz)
    expect(result.frames).toEqual([])
    expect(result.binCount).toBe(0)
  })

  it('produces multiple frames with finite log-magnitudes for a tone', () => {
    const samples = synthesizeSineWave({
      frequencyInHertz: 440,
      sampleRateInHertz,
      durationSeconds: 0.2,
    })
    const result = computeLogMagnitudeSpectrogram(samples, sampleRateInHertz)
    expect(result.frames.length).toBeGreaterThan(10)
    expect(result.binCount).toBeGreaterThan(10)
    for (const frame of result.frames) {
      expect(frame.length).toBe(result.binCount)
      for (let bin = 0; bin < frame.length; bin += 1) {
        expect(Number.isFinite(frame[bin]!)).toBe(true)
      }
    }
  })

  it('concentrates energy near the expected frequency bin for a pure tone', () => {
    const frequencyInHertz = 1000
    const samples = synthesizeSineWave({
      frequencyInHertz,
      sampleRateInHertz,
      durationSeconds: 0.25,
    })
    const result = computeLogMagnitudeSpectrogram(samples, sampleRateInHertz, {
      maximumFrequencyInHertz: 4000,
    })
    expect(result.frames.length).toBeGreaterThan(5)

    // Average power across frames per bin; peak should be near 1 kHz.
    const average = new Float32Array(result.binCount)
    for (const frame of result.frames) {
      for (let bin = 0; bin < result.binCount; bin += 1) {
        average[bin] = (average[bin] ?? 0) + (frame[bin] ?? 0)
      }
    }
    let peakBin = 0
    let peakValue = Number.NEGATIVE_INFINITY
    for (let bin = 1; bin < result.binCount; bin += 1) {
      const value = average[bin] ?? Number.NEGATIVE_INFINITY
      if (value > peakValue) {
        peakValue = value
        peakBin = bin
      }
    }
    const peakFrequencyInHertz = (peakBin * sampleRateInHertz) / result.fftSize
    expect(peakFrequencyInHertz).toBeGreaterThan(700)
    expect(peakFrequencyInHertz).toBeLessThan(1300)
  })
})

describe('computeSpectrogramValueRange', () => {
  it('returns null for empty spectrogram', () => {
    expect(
      computeSpectrogramValueRange({
        frames: [],
        sampleRateInHertz: 16000,
        fftSize: 0,
        hopLengthInSamples: 0,
        binCount: 0,
        maximumFrequencyInHertz: 0,
      }),
    ).toBeNull()
  })

  it('returns min/max over frames', () => {
    const range = computeSpectrogramValueRange({
      frames: [new Float32Array([-5, -1, -3]), new Float32Array([-4, 0, -2])],
      sampleRateInHertz: 16000,
      fftSize: 512,
      hopLengthInSamples: 160,
      binCount: 3,
      maximumFrequencyInHertz: 8000,
    })
    expect(range).toEqual({ minimum: -5, maximum: 0 })
  })
})
