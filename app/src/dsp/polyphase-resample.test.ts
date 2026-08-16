import { describe, expect, it } from 'vitest'
import {
  FIR_44K1_DOWNSAMPLE_FACTOR,
  FIR_44K1_GROUP_DELAY_INPUT_SAMPLES,
  FIR_44K1_INPUT_RATE_HZ,
  FIR_44K1_MACS_PER_OUTPUT,
  FIR_44K1_PROTOTYPE_TAP_COUNT,
  FIR_44K1_TAPS_PER_PHASE,
  FIR_44K1_UPSAMPLE_FACTOR,
  FIR_48K_DECIMATION_FACTOR,
  FIR_48K_GROUP_DELAY_MILLISECONDS,
  FIR_48K_INPUT_RATE_HZ,
  FIR_48K_MACS_PER_INPUT,
  FIR_48K_MACS_PER_OUTPUT,
  FIR_48K_TAPS_PER_PHASE,
  FIR_ALIAS_PROBE_TONE_HZ,
  FIR_DESTINATION_NYQUIST_HZ,
  FIR_GROUP_DELAY_INPUT_SAMPLES,
  FIR_INPUT_SPAN_TAP_COUNT,
  FIR_MIN_ALIAS_ATTENUATION_DB,
  FIR_OUTPUT_RATE_HZ,
  decimate48kHzTo16kHz,
  greatestCommonDivisor,
  reducedSampleRateRatio,
  resample44k1To16kHz,
  splitIntoPolyphaseBranches,
} from './polyphase-resample'

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

function aliasAttenuationDb(output: Float32Array, skipEachSide: number): number {
  const residual = steadyStateRms(output, skipEachSide)
  const fullScaleRms = Math.SQRT1_2
  const ratio = Math.max(residual / fullScaleRms, 1e-12)
  return -20 * Math.log10(ratio)
}

function peakIndex(samples: Float32Array): number {
  let bestIndex = 0
  let bestAbs = 0
  for (let index = 0; index < samples.length; index += 1) {
    const abs = Math.abs(samples[index] ?? 0)
    if (abs > bestAbs) {
      bestAbs = abs
      bestIndex = index
    }
  }
  return bestIndex
}

describe('reducedSampleRateRatio', () => {
  it('reduces 44.1 kHz → 16 kHz to 160/441, not 1/3', () => {
    expect(greatestCommonDivisor(44100, 16000)).toBe(100)
    expect(reducedSampleRateRatio(44100, 16000)).toEqual({
      upsample: FIR_44K1_UPSAMPLE_FACTOR,
      downsample: FIR_44K1_DOWNSAMPLE_FACTOR,
    })
    expect(FIR_44K1_UPSAMPLE_FACTOR / FIR_44K1_DOWNSAMPLE_FACTOR).not.toBeCloseTo(
      1 / FIR_48K_DECIMATION_FACTOR,
      2,
    )
  })
})

describe('splitIntoPolyphaseBranches', () => {
  it('keeps N taps across M branches so cost per output is N, not N×M', () => {
    const prototype = new Float32Array(FIR_INPUT_SPAN_TAP_COUNT)
    for (let index = 0; index < prototype.length; index += 1) {
      prototype[index] = index + 1
    }
    const branches = splitIntoPolyphaseBranches(prototype, 3)
    expect(branches.length).toBe(3)
    expect(branches[0]?.length).toBe(FIR_48K_TAPS_PER_PHASE)
    expect(FIR_48K_MACS_PER_OUTPUT).toBe(FIR_INPUT_SPAN_TAP_COUNT)
    expect(FIR_48K_MACS_PER_INPUT).toBe(FIR_48K_TAPS_PER_PHASE)
    expect(FIR_44K1_MACS_PER_OUTPUT).toBe(FIR_44K1_TAPS_PER_PHASE)
    expect(FIR_44K1_MACS_PER_OUTPUT).toBeLessThan(FIR_44K1_PROTOTYPE_TAP_COUNT / 10)
  })
})

describe('decimate48kHzTo16kHz', () => {
  it('keeps one third of the samples and the DC value in steady state', () => {
    const constant = new Float32Array(4800).fill(0.42)
    const resampled = decimate48kHzTo16kHz(constant)
    expect(resampled.length).toBe(1600)
    expect(steadyStateRms(resampled, 40)).toBeCloseTo(0.42, 3)
  })

  it('attenuates a 12 kHz alias tone by at least the published floor', () => {
    const tone = createTone(FIR_ALIAS_PROBE_TONE_HZ, FIR_48K_INPUT_RATE_HZ, 0.25)
    const firDb = aliasAttenuationDb(decimate48kHzTo16kHz(tone), 80)
    expect(FIR_ALIAS_PROBE_TONE_HZ).toBeGreaterThan(FIR_DESTINATION_NYQUIST_HZ)
    expect(firDb).toBeGreaterThanOrEqual(FIR_MIN_ALIAS_ATTENUATION_DB)
  })

  it('places an impulse peak at the published group delay', () => {
    const impulse = new Float32Array(4800)
    const impulseIndex = 2400
    impulse[impulseIndex] = 1
    const resampled = decimate48kHzTo16kHz(impulse)
    const expectedOutputIndex =
      (impulseIndex + FIR_GROUP_DELAY_INPUT_SAMPLES) / FIR_48K_DECIMATION_FACTOR
    expect(peakIndex(resampled)).toBeCloseTo(expectedOutputIndex, 0)
    expect(FIR_48K_GROUP_DELAY_MILLISECONDS).toBeCloseTo(0.958, 2)
  })
})

describe('resample44k1To16kHz', () => {
  it('uses 160/441 length, not input/3', () => {
    const silence = new Float32Array(44100)
    const resampled = resample44k1To16kHz(silence)
    expect(resampled.length).toBe(16000)
    expect(resampled.length).not.toBe(14700)
  })

  it('preserves DC and rejects the same 12 kHz probe as the 48 kHz path', () => {
    const constant = new Float32Array(4410).fill(0.5)
    const constantOut = resample44k1To16kHz(constant)
    expect(steadyStateRms(constantOut, 40)).toBeCloseTo(0.5, 2)

    const tone = createTone(FIR_ALIAS_PROBE_TONE_HZ, FIR_44K1_INPUT_RATE_HZ, 0.25)
    const firDb = aliasAttenuationDb(resample44k1To16kHz(tone), 80)
    expect(firDb).toBeGreaterThanOrEqual(FIR_MIN_ALIAS_ATTENUATION_DB)
  })

  it('delays an impulse by the input-referred prototype delay', () => {
    const impulse = new Float32Array(22050)
    const impulseIndex = 11025
    impulse[impulseIndex] = 1
    const resampled = resample44k1To16kHz(impulse)
    const expectedOutputIndex =
      ((impulseIndex + FIR_44K1_GROUP_DELAY_INPUT_SAMPLES) * FIR_OUTPUT_RATE_HZ) /
      FIR_44K1_INPUT_RATE_HZ
    expect(peakIndex(resampled)).toBeCloseTo(expectedOutputIndex, 0)
  })
})
