/**
 * Hann-windowed sinc low-pass. Symmetric taps → linear phase, delay (N-1)/2.
 */

import { createHannWindow } from './mfcc-extraction'

export interface LinearPhaseLowpassFirSpec {
  readonly tapCount: number
  readonly cutoffFrequencyInHertz: number
  readonly sampleRateInHertz: number
  /** Sum of coefficients after design. Default 1 (unity DC). */
  readonly dcGain?: number
}

export function normalizedSinc(x: number): number {
  if (Math.abs(x) < 1e-12) {
    return 1
  }
  return Math.sin(Math.PI * x) / (Math.PI * x)
}

export function linearPhaseGroupDelayInSamples(tapCount: number): number {
  return (Math.max(1, Math.floor(tapCount)) - 1) / 2
}

/**
 * Windowed-sinc low-pass, then scaled so Σh = dcGain.
 * Invalid cutoff/rate yields a centered impulse of that gain (no throw).
 */
export function designHannWindowedSincLowpass(
  spec: LinearPhaseLowpassFirSpec,
): Float32Array {
  const tapCount = Math.max(1, Math.floor(spec.tapCount))
  const dcGain = spec.dcGain ?? 1
  const coefficients = new Float64Array(tapCount)
  const cutoff = spec.cutoffFrequencyInHertz
  const sampleRate = spec.sampleRateInHertz
  const canDesign =
    Number.isFinite(cutoff) &&
    Number.isFinite(sampleRate) &&
    cutoff > 0 &&
    sampleRate > 0 &&
    cutoff < sampleRate / 2

  if (!canDesign) {
    coefficients[Math.floor((tapCount - 1) / 2)] = dcGain
    return float64ToFloat32(coefficients)
  }

  const window = createHannWindow(tapCount)
  const groupDelay = linearPhaseGroupDelayInSamples(tapCount)
  const cyclesPerSample = cutoff / sampleRate
  for (let tapIndex = 0; tapIndex < tapCount; tapIndex += 1) {
    const time = tapIndex - groupDelay
    const windowValue = window[tapIndex] ?? 0
    coefficients[tapIndex] =
      2 * cyclesPerSample * normalizedSinc(2 * cyclesPerSample * time) * windowValue
  }
  return scaleCoefficientsToDcGain(coefficients, dcGain)
}

function scaleCoefficientsToDcGain(coefficients: Float64Array, dcGain: number): Float32Array {
  let sum = 0
  for (let tapIndex = 0; tapIndex < coefficients.length; tapIndex += 1) {
    sum += coefficients[tapIndex] ?? 0
  }
  const scale = sum === 0 ? 1 : dcGain / sum
  const scaled = new Float32Array(coefficients.length)
  for (let tapIndex = 0; tapIndex < coefficients.length; tapIndex += 1) {
    scaled[tapIndex] = (coefficients[tapIndex] ?? 0) * scale
  }
  return scaled
}

function float64ToFloat32(coefficients: Float64Array): Float32Array {
  const output = new Float32Array(coefficients.length)
  output.set(coefficients)
  return output
}
