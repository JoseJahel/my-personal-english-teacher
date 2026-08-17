import { describe, expect, it } from 'vitest'
import {
  VOICE_BANDPASS_HIGHPASS_HZ,
  VOICE_BANDPASS_IN_BAND_PROBE_HZ,
  VOICE_BANDPASS_LOWPASS_HZ,
  VOICE_BANDPASS_MIN_STOPBAND_ATTENUATION_DB,
  VOICE_BANDPASS_RUMBLE_PROBE_HZ,
  applyVoiceBandpass,
} from './biquad-voice-bandpass'

const SAMPLE_RATE_HZ = 16_000

function createTone(
  frequencyInHertz: number,
  sampleRateInHertz: number,
  durationInSeconds: number,
): Float32Array {
  const sampleCount = Math.round(sampleRateInHertz * durationInSeconds)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequencyInHertz * index) / sampleRateInHertz)
  }
  return samples
}

function steadyStateRms(samples: Float32Array, skipEachSide: number): number {
  const start = Math.min(skipEachSide, Math.floor(samples.length / 4))
  const end = Math.max(start + 1, samples.length - start)
  let sumOfSquares = 0
  let count = 0
  for (let index = start; index < end; index += 1) {
    const value = samples[index] ?? 0
    sumOfSquares += value * value
    count += 1
  }
  return count === 0 ? 0 : Math.sqrt(sumOfSquares / count)
}

function gainDbAt(frequencyInHertz: number): number {
  const tone = createTone(frequencyInHertz, SAMPLE_RATE_HZ, 1)
  const filtered = applyVoiceBandpass(tone, SAMPLE_RATE_HZ)
  const skip = Math.round(SAMPLE_RATE_HZ * 0.2)
  const inputRms = steadyStateRms(tone, skip)
  const outputRms = steadyStateRms(filtered, skip)
  return 20 * Math.log10(outputRms / inputRms)
}

describe('applyVoiceBandpass', () => {
  it('returns an empty buffer for empty input', () => {
    expect(applyVoiceBandpass(new Float32Array(0), SAMPLE_RATE_HZ).length).toBe(0)
  })

  it('copies input when the sample rate is unusable', () => {
    const samples = new Float32Array([0.2, -0.1, 0.4])
    expect(Array.from(applyVoiceBandpass(samples, 0))).toEqual(Array.from(samples))
    expect(Array.from(applyVoiceBandpass(samples, Number.NaN))).toEqual(Array.from(samples))
  })

  it('passes a 1 kHz in-band tone near unity gain', () => {
    const gainDb = gainDbAt(VOICE_BANDPASS_IN_BAND_PROBE_HZ)
    expect(gainDb).toBeGreaterThan(-1)
    expect(gainDb).toBeLessThan(1)
  })

  it('is about -3 dB at the documented high-pass cutoff', () => {
    const gainDb = gainDbAt(VOICE_BANDPASS_HIGHPASS_HZ)
    expect(gainDb).toBeGreaterThan(-4)
    expect(gainDb).toBeLessThan(-2)
  })

  it('is about -3 dB at the documented low-pass cutoff', () => {
    const gainDb = gainDbAt(VOICE_BANDPASS_LOWPASS_HZ)
    expect(gainDb).toBeGreaterThan(-4)
    expect(gainDb).toBeLessThan(-2)
  })

  it('attenuates rumble well below the high-pass edge', () => {
    const gainDb = gainDbAt(VOICE_BANDPASS_RUMBLE_PROBE_HZ)
    expect(gainDb).toBeLessThan(-VOICE_BANDPASS_MIN_STOPBAND_ATTENUATION_DB)
  })

  it('is a single forward pass: a second pass is not a no-op', () => {
    const rumble = createTone(VOICE_BANDPASS_RUMBLE_PROBE_HZ, SAMPLE_RATE_HZ, 1)
    const once = applyVoiceBandpass(rumble, SAMPLE_RATE_HZ)
    const twice = applyVoiceBandpass(once, SAMPLE_RATE_HZ)
    const skip = Math.round(SAMPLE_RATE_HZ * 0.2)
    expect(steadyStateRms(twice, skip)).toBeLessThan(steadyStateRms(once, skip) * 0.5)
  })
})
