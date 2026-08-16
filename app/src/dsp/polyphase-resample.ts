/**
 * Linear-phase FIR resample to 16 kHz (issue #92).
 * 48 kHz: integer decimation ×3. 44.1 kHz: rational 160/441 — not “treat as 48”.
 */

import {
  designHannWindowedSincLowpass,
  linearPhaseGroupDelayInSamples,
} from './design-linear-phase-lowpass-fir'

export const FIR_OUTPUT_RATE_HZ = 16000
export const FIR_DESTINATION_NYQUIST_HZ = 8000
export const FIR_LOWPASS_CUTOFF_HZ = 7200
export const FIR_ALIAS_PROBE_TONE_HZ = 12000
/** Conservative floor; 12 kHz probe measured ~85 dB on both device rates. */
export const FIR_MIN_ALIAS_ATTENUATION_DB = 50
export const FIR_INPUT_SPAN_TAP_COUNT = 93
export const FIR_GROUP_DELAY_INPUT_SAMPLES = linearPhaseGroupDelayInSamples(
  FIR_INPUT_SPAN_TAP_COUNT,
)
export const FIR_48K_INPUT_RATE_HZ = 48000
export const FIR_48K_DECIMATION_FACTOR = 3
export const FIR_48K_PHASE_COUNT = 3
export const FIR_48K_TAPS_PER_PHASE = FIR_INPUT_SPAN_TAP_COUNT / FIR_48K_PHASE_COUNT
export const FIR_48K_MACS_PER_OUTPUT = FIR_INPUT_SPAN_TAP_COUNT
export const FIR_48K_MACS_PER_INPUT = FIR_48K_TAPS_PER_PHASE
export const FIR_48K_GROUP_DELAY_MILLISECONDS =
  FIR_GROUP_DELAY_INPUT_SAMPLES / (FIR_48K_INPUT_RATE_HZ / 1000)
export const FIR_44K1_INPUT_RATE_HZ = 44100
export const FIR_44K1_UPSAMPLE_FACTOR = 160
export const FIR_44K1_DOWNSAMPLE_FACTOR = 441
export const FIR_44K1_PHASE_COUNT = FIR_44K1_UPSAMPLE_FACTOR
export const FIR_44K1_TAPS_PER_PHASE = FIR_INPUT_SPAN_TAP_COUNT
export const FIR_44K1_PROTOTYPE_TAP_COUNT = FIR_44K1_PHASE_COUNT * FIR_44K1_TAPS_PER_PHASE
export const FIR_44K1_MACS_PER_OUTPUT = FIR_44K1_TAPS_PER_PHASE
export const FIR_44K1_HIGH_RATE_HZ = FIR_44K1_INPUT_RATE_HZ * FIR_44K1_UPSAMPLE_FACTOR
export const FIR_44K1_GROUP_DELAY_INPUT_SAMPLES =
  linearPhaseGroupDelayInSamples(FIR_44K1_PROTOTYPE_TAP_COUNT) / FIR_44K1_UPSAMPLE_FACTOR
export const FIR_44K1_GROUP_DELAY_MILLISECONDS =
  FIR_44K1_GROUP_DELAY_INPUT_SAMPLES / (FIR_44K1_INPUT_RATE_HZ / 1000)

let decimate48Branches: readonly Float32Array[] | undefined
let rational44k1Branches: readonly Float32Array[] | undefined

export function greatestCommonDivisor(left: number, right: number): number {
  let first = Math.abs(Math.trunc(left))
  let second = Math.abs(Math.trunc(right))
  while (second !== 0) {
    const remainder = first % second
    first = second
    second = remainder
  }
  return first
}

export function reducedSampleRateRatio(
  inputSampleRate: number,
  outputSampleRate: number,
): { readonly upsample: number; readonly downsample: number } {
  const divisor = greatestCommonDivisor(inputSampleRate, outputSampleRate)
  if (divisor === 0) {
    return { upsample: 0, downsample: 0 }
  }
  return {
    upsample: outputSampleRate / divisor,
    downsample: inputSampleRate / divisor,
  }
}

export function splitIntoPolyphaseBranches(
  prototype: Float32Array,
  phaseCount: number,
): Float32Array[] {
  const phases = Math.max(1, Math.floor(phaseCount))
  const tapsPerPhase = Math.ceil(prototype.length / phases)
  const branches: Float32Array[] = []
  for (let phase = 0; phase < phases; phase += 1) {
    const branch = new Float32Array(tapsPerPhase)
    for (let tap = 0; tap < tapsPerPhase; tap += 1) {
      branch[tap] = prototype[tap * phases + phase] ?? 0
    }
    branches.push(branch)
  }
  return branches
}

export function decimate48kHzTo16kHz(samples: Float32Array): Float32Array {
  if (samples.length === 0) {
    return new Float32Array(0)
  }
  const outputLength = Math.max(1, Math.round(samples.length / FIR_48K_DECIMATION_FACTOR))
  return applyIntegerDecimator(
    samples,
    getDecimate48Branches(),
    FIR_48K_DECIMATION_FACTOR,
    outputLength,
  )
}

export function resample44k1To16kHz(samples: Float32Array): Float32Array {
  if (samples.length === 0) {
    return new Float32Array(0)
  }
  const outputLength = Math.max(
    1,
    Math.round((samples.length * FIR_OUTPUT_RATE_HZ) / FIR_44K1_INPUT_RATE_HZ),
  )
  return applyRationalResampler(
    samples,
    getRational44k1Branches(),
    FIR_44K1_UPSAMPLE_FACTOR,
    FIR_44K1_DOWNSAMPLE_FACTOR,
    outputLength,
  )
}

function getDecimate48Branches(): readonly Float32Array[] {
  if (!decimate48Branches) {
    const prototype = designHannWindowedSincLowpass({
      tapCount: FIR_INPUT_SPAN_TAP_COUNT,
      cutoffFrequencyInHertz: FIR_LOWPASS_CUTOFF_HZ,
      sampleRateInHertz: FIR_48K_INPUT_RATE_HZ,
      dcGain: 1,
    })
    decimate48Branches = splitIntoPolyphaseBranches(prototype, FIR_48K_PHASE_COUNT)
  }
  return decimate48Branches
}

function getRational44k1Branches(): readonly Float32Array[] {
  if (!rational44k1Branches) {
    const prototype = designHannWindowedSincLowpass({
      tapCount: FIR_44K1_PROTOTYPE_TAP_COUNT,
      cutoffFrequencyInHertz: FIR_LOWPASS_CUTOFF_HZ,
      sampleRateInHertz: FIR_44K1_HIGH_RATE_HZ,
      dcGain: FIR_44K1_UPSAMPLE_FACTOR,
    })
    rational44k1Branches = splitIntoPolyphaseBranches(prototype, FIR_44K1_PHASE_COUNT)
  }
  return rational44k1Branches
}

function readSampleOrZero(samples: Float32Array, index: number): number {
  if (index < 0 || index >= samples.length) {
    return 0
  }
  return samples[index] ?? 0
}

function applyIntegerDecimator(
  samples: Float32Array,
  branches: readonly Float32Array[],
  factor: number,
  outputLength: number,
): Float32Array {
  const output = new Float32Array(outputLength)
  const phaseCount = branches.length
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    output[outputIndex] = dotPolyphaseDecimator(
      samples,
      branches,
      outputIndex * factor,
      phaseCount,
    )
  }
  return output
}

function dotPolyphaseDecimator(
  samples: Float32Array,
  branches: readonly Float32Array[],
  baseIndex: number,
  phaseCount: number,
): number {
  let accumulator = 0
  for (let phase = 0; phase < phaseCount; phase += 1) {
    const branch = branches[phase]
    if (!branch) {
      continue
    }
    for (let tap = 0; tap < branch.length; tap += 1) {
      const inputIndex = baseIndex - phase - tap * phaseCount
      accumulator += (branch[tap] ?? 0) * readSampleOrZero(samples, inputIndex)
    }
  }
  return accumulator
}

function applyRationalResampler(
  samples: Float32Array,
  branches: readonly Float32Array[],
  upsampleFactor: number,
  downsampleFactor: number,
  outputLength: number,
): Float32Array {
  const output = new Float32Array(outputLength)
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const highRateIndex = outputIndex * downsampleFactor
    const phase = highRateIndex % upsampleFactor
    const inputIndex = Math.floor(highRateIndex / upsampleFactor)
    output[outputIndex] = dotBranch(samples, branches[phase], inputIndex)
  }
  return output
}

function dotBranch(
  samples: Float32Array,
  branch: Float32Array | undefined,
  inputIndex: number,
): number {
  if (!branch) {
    return 0
  }
  let accumulator = 0
  for (let tap = 0; tap < branch.length; tap += 1) {
    accumulator += (branch[tap] ?? 0) * readSampleOrZero(samples, inputIndex - tap)
  }
  return accumulator
}
