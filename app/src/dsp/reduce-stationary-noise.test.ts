import { describe, expect, it } from 'vitest'
import { computeRootMeanSquareEnergy } from './signal-energy'
import { reduceStationaryNoiseFromMonoPcm } from './reduce-stationary-noise'

const SAMPLE_RATE_HZ = 16_000

function sineWave(
  durationSeconds: number,
  frequencyHz: number,
  amplitude: number,
): Float32Array {
  const sampleCount = Math.round(durationSeconds * SAMPLE_RATE_HZ)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / SAMPLE_RATE_HZ)
  }
  return samples
}

function seededNoise(length: number, amplitude: number, seed: number): Float32Array {
  const samples = new Float32Array(length)
  let state = seed
  for (let index = 0; index < length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    samples[index] = amplitude * ((state / 0xffffffff) * 2 - 1)
  }
  return samples
}

function rmsSlice(samples: Float32Array, start: number, end: number): number {
  return computeRootMeanSquareEnergy(samples.subarray(start, end))
}

describe('reduceStationaryNoiseFromMonoPcm', () => {
  it('leaves a continuous clean tone almost unchanged (no quiet frames)', () => {
    const clean = sineWave(0.4, 400, 0.35)
    const reduced = reduceStationaryNoiseFromMonoPcm(clean, SAMPLE_RATE_HZ)
    const inputRms = computeRootMeanSquareEnergy(clean)
    const outputRms = computeRootMeanSquareEnergy(reduced)
    expect(Math.abs(outputRms - inputRms) / inputRms).toBeLessThan(0.05)
  })

  it('reconstructs a burst signal when Wiener gain is forced to 1', () => {
    const tone = sineWave(0.25, 350, 0.4)
    const leading = Math.round(0.12 * SAMPLE_RATE_HZ)
    const mixed = new Float32Array(leading + tone.length + leading)
    mixed.set(seededNoise(mixed.length, 0.08, 7))
    mixed.set(tone.map((sample, index) => (mixed[leading + index] ?? 0) + sample), leading)
    const reconstructed = reduceStationaryNoiseFromMonoPcm(mixed, SAMPLE_RATE_HZ, {
      oversubtraction: 0,
      spectralFloor: 1,
    })
    const inputRms = computeRootMeanSquareEnergy(mixed)
    const outputRms = computeRootMeanSquareEnergy(reconstructed)
    expect(Math.abs(outputRms - inputRms) / inputRms).toBeLessThan(0.08)
  })

  it('lowers noise-only regions more than the voiced burst', () => {
    const tone = sineWave(0.25, 350, 0.4)
    const leading = Math.round(0.12 * SAMPLE_RATE_HZ)
    const trailing = Math.round(0.12 * SAMPLE_RATE_HZ)
    const mixed = new Float32Array(leading + tone.length + trailing)
    const noise = seededNoise(mixed.length, 0.08, 7)
    mixed.set(noise)
    for (let index = 0; index < tone.length; index += 1) {
      mixed[leading + index] = (mixed[leading + index] ?? 0) + (tone[index] ?? 0)
    }

    const reduced = reduceStationaryNoiseFromMonoPcm(mixed, SAMPLE_RATE_HZ)
    const noiseInteriorEnd = leading - Math.round(0.04 * SAMPLE_RATE_HZ)
    const noiseBefore = rmsSlice(mixed, 0, noiseInteriorEnd)
    const noiseAfter = rmsSlice(reduced, 0, noiseInteriorEnd)
    const speechBefore = rmsSlice(mixed, leading, leading + tone.length)
    const speechAfter = rmsSlice(reduced, leading, leading + tone.length)

    expect(noiseAfter).toBeLessThan(noiseBefore * 0.75)
    expect(speechAfter).toBeGreaterThan(speechBefore * 0.7)
    expect(speechAfter / Math.max(noiseAfter, 1e-8)).toBeGreaterThan(
      speechBefore / Math.max(noiseBefore, 1e-8),
    )
  })

  it('returns a copy when disabled or when the buffer is too short', () => {
    const short = sineWave(0.02, 200, 0.2)
    const disabled = reduceStationaryNoiseFromMonoPcm(short, SAMPLE_RATE_HZ, { enabled: false })
    expect(disabled).not.toBe(short)
    expect(Array.from(disabled)).toEqual(Array.from(short))

    const skipped = reduceStationaryNoiseFromMonoPcm(short, SAMPLE_RATE_HZ)
    expect(Array.from(skipped)).toEqual(Array.from(short))
  })
})
