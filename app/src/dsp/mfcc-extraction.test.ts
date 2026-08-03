import { describe, expect, it } from 'vitest'
import {
  computeMfccVectorEuclideanDistance,
  createHannWindow,
  createMelFilterbank,
  DEFAULT_MFCC_COEFFICIENT_COUNT,
  DEFAULT_MFCC_FRAME_DURATION_SECONDS,
  DEFAULT_MFCC_HOP_DURATION_SECONDS,
  DEFAULT_MFCC_MEL_FILTER_COUNT,
  extractMfccSequence,
  hertzToMel,
  melToHertz,
  nextPowerOfTwo,
} from './mfcc-extraction'

function synthesizeSineWave(options: {
  frequencyInHertz: number
  sampleRateInHertz: number
  durationSeconds: number
  amplitude?: number
}): Float32Array {
  const { frequencyInHertz, sampleRateInHertz, durationSeconds, amplitude = 0.5 } = options
  const sampleCount = Math.floor(durationSeconds * sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] =
      amplitude * Math.sin((2 * Math.PI * frequencyInHertz * index) / sampleRateInHertz)
  }
  return samples
}

describe('mel scale helpers', () => {
  it('round-trips hertz ↔ mel for speech-band frequencies', () => {
    for (const frequency of [100, 440, 1000, 4000, 8000]) {
      expect(melToHertz(hertzToMel(frequency))).toBeCloseTo(frequency, 5)
    }
  })
})

describe('nextPowerOfTwo / Hann window', () => {
  it('rounds up to the next power of two', () => {
    expect(nextPowerOfTwo(400)).toBe(512)
    expect(nextPowerOfTwo(512)).toBe(512)
    expect(nextPowerOfTwo(1)).toBe(1)
  })

  it('builds a Hann window that is 1 at the center and 0 at the ends', () => {
    const window = createHannWindow(5)
    expect(window[0]).toBeCloseTo(0, 5)
    expect(window[2]).toBeCloseTo(1, 5)
    expect(window[4]).toBeCloseTo(0, 5)
  })
})

describe('createMelFilterbank', () => {
  it('returns the configured number of filters with non-negative weights', () => {
    const filterbank = createMelFilterbank({
      sampleRateInHertz: 16000,
      fftSize: 512,
      melFilterCount: DEFAULT_MFCC_MEL_FILTER_COUNT,
      minimumFrequencyInHertz: 0,
      maximumFrequencyInHertz: 8000,
    })
    expect(filterbank).toHaveLength(DEFAULT_MFCC_MEL_FILTER_COUNT)
    for (const weights of filterbank) {
      expect(weights.length).toBe(257)
      let maxWeight = 0
      for (let bin = 0; bin < weights.length; bin += 1) {
        expect(weights[bin]!).toBeGreaterThanOrEqual(0)
        maxWeight = Math.max(maxWeight, weights[bin]!)
      }
      // Each triangular filter should peak somewhere.
      expect(maxWeight).toBeGreaterThan(0)
    }
  })
})

describe('extractMfccSequence', () => {
  const sampleRateInHertz = 16000

  it('returns an empty sequence for empty audio', () => {
    expect(extractMfccSequence(new Float32Array(0), sampleRateInHertz)).toEqual([])
  })

  it('uses project defaults: 13 coeffs, ~25 ms frame, ~10 ms hop', () => {
    const samples = synthesizeSineWave({
      frequencyInHertz: 220,
      sampleRateInHertz,
      durationSeconds: 0.2,
    })
    const frames = extractMfccSequence(samples, sampleRateInHertz)
    expect(frames.length).toBeGreaterThan(10)
    expect(frames[0]!.coefficients).toHaveLength(DEFAULT_MFCC_COEFFICIENT_COUNT)

    const expectedFrameLength = Math.floor(DEFAULT_MFCC_FRAME_DURATION_SECONDS * sampleRateInHertz)
    const expectedHop = Math.floor(DEFAULT_MFCC_HOP_DURATION_SECONDS * sampleRateInHertz)
    // Number of frames ≈ 1 + floor((N - frame) / hop)
    const expectedCount =
      1 + Math.floor((samples.length - expectedFrameLength) / expectedHop)
    expect(frames.length).toBe(expectedCount)

    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index]!.timeInSeconds).toBeCloseTo(
        frames[index - 1]!.timeInSeconds + expectedHop / sampleRateInHertz,
        8,
      )
    }
  })

  it('produces finite coefficients for a pure tone', () => {
    const samples = synthesizeSineWave({
      frequencyInHertz: 440,
      sampleRateInHertz,
      durationSeconds: 0.15,
    })
    const frames = extractMfccSequence(samples, sampleRateInHertz)
    for (const frame of frames) {
      expect(frame.coefficients).toHaveLength(13)
      for (let index = 0; index < frame.coefficients.length; index += 1) {
        expect(Number.isFinite(frame.coefficients[index]!)).toBe(true)
      }
    }
  })

  it('yields smaller frame-to-frame distance for a steady tone than tone vs noise', () => {
    const tone = synthesizeSineWave({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.2,
    })
    const toneFrames = extractMfccSequence(tone, sampleRateInHertz)
    expect(toneFrames.length).toBeGreaterThan(2)

    let tonePairDistanceSum = 0
    let tonePairCount = 0
    for (let index = 1; index < toneFrames.length; index += 1) {
      tonePairDistanceSum += computeMfccVectorEuclideanDistance(
        toneFrames[index - 1]!.coefficients,
        toneFrames[index]!.coefficients,
      )
      tonePairCount += 1
    }
    const meanToneDistance = tonePairDistanceSum / tonePairCount

    const noise = new Float32Array(tone.length)
    let seed = 7
    for (let index = 0; index < noise.length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      noise[index] = seed / 0xffffffff - 0.5
    }
    const noiseFrames = extractMfccSequence(noise, sampleRateInHertz)
    const crossDistance = computeMfccVectorEuclideanDistance(
      toneFrames[Math.floor(toneFrames.length / 2)]!.coefficients,
      noiseFrames[Math.floor(noiseFrames.length / 2)]!.coefficients,
    )

    // Steady sine frames should be more self-similar than a mid-frame vs noise.
    expect(meanToneDistance).toBeLessThan(crossDistance)
  })

  it('distinguishes two different pure tones via MFCC distance', () => {
    const low = extractMfccSequence(
      synthesizeSineWave({
        frequencyInHertz: 150,
        sampleRateInHertz,
        durationSeconds: 0.15,
      }),
      sampleRateInHertz,
    )
    const high = extractMfccSequence(
      synthesizeSineWave({
        frequencyInHertz: 350,
        sampleRateInHertz,
        durationSeconds: 0.15,
      }),
      sampleRateInHertz,
    )
    const same = computeMfccVectorEuclideanDistance(
      low[Math.floor(low.length / 2)]!.coefficients,
      low[Math.floor(low.length / 2) + 1]!.coefficients,
    )
    const different = computeMfccVectorEuclideanDistance(
      low[Math.floor(low.length / 2)]!.coefficients,
      high[Math.floor(high.length / 2)]!.coefficients,
    )
    expect(different).toBeGreaterThan(same)
  })

  it('computeMfccVectorEuclideanDistance is zero for identical vectors', () => {
    const vector = new Float32Array([1, 2, 3, 4])
    expect(computeMfccVectorEuclideanDistance(vector, vector)).toBe(0)
  })
})
