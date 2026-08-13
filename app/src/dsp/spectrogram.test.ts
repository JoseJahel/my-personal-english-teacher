import { describe, expect, it } from 'vitest'
import { computeNaiveDiscreteFourierTransform } from './dft-reference'
import { createHannWindow, nextPowerOfTwo } from './mfcc-extraction'
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
    const binWidthInHertz = sampleRateInHertz / result.fftSize
    expect(Math.abs(peakFrequencyInHertz - frequencyInHertz)).toBeLessThan(binWidthInHertz * 1.5)
  })

  it('matches textbook DFT peak bin and log-magnitude on the first STFT frame', () => {
    const frequencyInHertz = 1000
    const samples = synthesizeSineWave({
      frequencyInHertz,
      sampleRateInHertz,
      durationSeconds: 0.025,
    })
    const result = computeLogMagnitudeSpectrogram(samples, sampleRateInHertz, {
      frameDurationSeconds: 0.025,
      hopDurationSeconds: 0.025,
      maximumFrequencyInHertz: sampleRateInHertz / 2,
    })
    expect(result.frames.length).toBe(1)
    const frame = result.frames[0]
    expect(frame).toBeDefined()

    const frameLength = samples.length
    const window = createHannWindow(frameLength)
    const fftSize = nextPowerOfTwo(frameLength)
    const windowed = new Float64Array(fftSize)
    for (let index = 0; index < frameLength; index += 1) {
      windowed[index] = (samples[index] ?? 0) * (window[index] ?? 0)
    }
    const spectrum = computeNaiveDiscreteFourierTransform(windowed)
    const expectedBin = Math.round((frequencyInHertz * fftSize) / sampleRateInHertz)
    const dftPowerAtPeak =
      (spectrum.real[expectedBin] ?? 0) ** 2 + (spectrum.imag[expectedBin] ?? 0) ** 2
    const expectedLog = Math.log10(dftPowerAtPeak + 1e-12)

    let peakBin = 0
    let peakValue = Number.NEGATIVE_INFINITY
    for (let bin = 1; bin < result.binCount; bin += 1) {
      const value = frame?.[bin] ?? Number.NEGATIVE_INFINITY
      if (value > peakValue) {
        peakValue = value
        peakBin = bin
      }
    }
    expect(fftSize).toBe(result.fftSize)
    expect(peakBin).toBe(expectedBin)
    expect(Math.abs((frame?.[expectedBin] ?? 0) - expectedLog)).toBeLessThan(1e-5)
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
