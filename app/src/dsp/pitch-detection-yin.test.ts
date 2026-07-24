import { describe, expect, it } from 'vitest'
import {
  computeMeanVoicedPitchInHertz,
  DEFAULT_YIN_MAXIMUM_FREQUENCY_HZ,
  DEFAULT_YIN_MINIMUM_FREQUENCY_HZ,
  estimatePitchWithYin,
  extractPitchContourWithYin,
} from './pitch-detection-yin'

function synthesizeSineWave(options: {
  frequencyInHertz: number
  sampleRateInHertz: number
  durationSeconds: number
  amplitude?: number
  phaseRadians?: number
}): Float32Array {
  const {
    frequencyInHertz,
    sampleRateInHertz,
    durationSeconds,
    amplitude = 0.5,
    phaseRadians = 0,
  } = options
  const sampleCount = Math.floor(durationSeconds * sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    const timeInSeconds = index / sampleRateInHertz
    samples[index] =
      amplitude * Math.sin(2 * Math.PI * frequencyInHertz * timeInSeconds + phaseRadians)
  }
  return samples
}

/** Relative tolerance for synthetic sines (YIN is accurate, not exact on short frames). */
function expectFrequencyNear(
  actualInHertz: number | null,
  expectedInHertz: number,
  relativeTolerance = 0.03,
): void {
  expect(actualInHertz).not.toBeNull()
  const relativeError = Math.abs(actualInHertz! - expectedInHertz) / expectedInHertz
  expect(relativeError).toBeLessThanOrEqual(relativeTolerance)
}

describe('estimatePitchWithYin', () => {
  it('returns null for empty or silent input', () => {
    expect(estimatePitchWithYin(new Float32Array(0), 16000).frequencyInHertz).toBeNull()
    expect(estimatePitchWithYin(new Float32Array(2048), 16000).frequencyInHertz).toBeNull()
  })

  it('estimates 440 Hz (A4) on a pure sine at 16 kHz', () => {
    const samples = synthesizeSineWave({
      frequencyInHertz: 440,
      sampleRateInHertz: 16000,
      durationSeconds: 0.1,
    })
    // A4 is above the default speech band; widen the search for this unit test.
    const estimate = estimatePitchWithYin(samples, 16000, {
      minimumFrequencyInHertz: 100,
      maximumFrequencyInHertz: 600,
    })
    expectFrequencyNear(estimate.frequencyInHertz, 440)
    expect(estimate.probability).toBeLessThan(0.2)
  })

  it('estimates a typical male speaking pitch (~120 Hz)', () => {
    const samples = synthesizeSineWave({
      frequencyInHertz: 120,
      sampleRateInHertz: 16000,
      durationSeconds: 0.12,
    })
    const estimate = estimatePitchWithYin(samples, 16000)
    expectFrequencyNear(estimate.frequencyInHertz, 120)
  })

  it('estimates a typical female speaking pitch (~220 Hz)', () => {
    const samples = synthesizeSineWave({
      frequencyInHertz: 220,
      sampleRateInHertz: 16000,
      durationSeconds: 0.12,
    })
    const estimate = estimatePitchWithYin(samples, 16000)
    expectFrequencyNear(estimate.frequencyInHertz, 220)
  })

  it('works at a device-native sample rate (48 kHz)', () => {
    const samples = synthesizeSineWave({
      frequencyInHertz: 150,
      sampleRateInHertz: 48000,
      durationSeconds: 0.1,
    })
    const estimate = estimatePitchWithYin(samples, 48000)
    expectFrequencyNear(estimate.frequencyInHertz, 150)
  })

  it('returns null for a tone below the configured minimum F0', () => {
    const samples = synthesizeSineWave({
      frequencyInHertz: 50,
      sampleRateInHertz: 16000,
      durationSeconds: 0.2,
    })
    const estimate = estimatePitchWithYin(samples, 16000, {
      minimumFrequencyInHertz: DEFAULT_YIN_MINIMUM_FREQUENCY_HZ,
      maximumFrequencyInHertz: DEFAULT_YIN_MAXIMUM_FREQUENCY_HZ,
    })
    // Period of 50 Hz is longer than the max search lag (sr / minF0).
    expect(estimate.frequencyInHertz).toBeNull()
  })

  it('returns null for white-ish noise (unvoiced)', () => {
    const noise = new Float32Array(3200)
    let seed = 42
    for (let index = 0; index < noise.length; index += 1) {
      // Simple LCG pseudo-random in [-0.5, 0.5]
      seed = (seed * 1664525 + 1013904223) >>> 0
      noise[index] = (seed / 0xffffffff) * 1 - 0.5
    }
    const estimate = estimatePitchWithYin(noise, 16000, {
      absoluteThreshold: 0.1,
    })
    expect(estimate.frequencyInHertz).toBeNull()
  })
})

describe('extractPitchContourWithYin', () => {
  it('returns an empty contour for empty audio', () => {
    expect(extractPitchContourWithYin(new Float32Array(0), 16000)).toEqual([])
  })

  it('tracks a steady 180 Hz tone across multiple frames', () => {
    const sampleRateInHertz = 16000
    const samples = synthesizeSineWave({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.25,
    })
    const contour = extractPitchContourWithYin(samples, sampleRateInHertz, {
      frameDurationSeconds: 0.04,
      hopDurationSeconds: 0.01,
    })
    expect(contour.length).toBeGreaterThan(10)

    const voiced = contour.filter((frame) => frame.frequencyInHertz !== null)
    expect(voiced.length).toBeGreaterThan(5)

    const mean = computeMeanVoicedPitchInHertz(contour)
    expect(mean).not.toBeNull()
    expect(mean!).toBeCloseTo(180, 0)

    // Contour times should be monotonic with the hop.
    for (let index = 1; index < contour.length; index += 1) {
      expect(contour[index]!.timeInSeconds).toBeGreaterThan(contour[index - 1]!.timeInSeconds)
    }
  })

  it('computeMeanVoicedPitchInHertz returns null when every frame is unvoiced', () => {
    const silenceContour = extractPitchContourWithYin(new Float32Array(8000), 16000)
    expect(computeMeanVoicedPitchInHertz(silenceContour)).toBeNull()
  })
})
