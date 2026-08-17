/**
 * Light adaptive stationary-noise reduction (issue #63 / RF-23).
 * Estimates a noise floor from quiet STFT frames, then applies a Wiener gain.
 * If the utterance has no quiet frames, the input is returned unchanged.
 */

import { nextPowerOfTwo } from './mfcc-extraction'
import { radix2ForwardFft } from './radix2-forward-fft'
import { radix2InverseFft } from './radix2-inverse-fft'

export const DEFAULT_NOISE_REDUCTION_FRAME_SECONDS = 0.032
export const DEFAULT_NOISE_REDUCTION_HOP_SECONDS = 0.016
/** Frames at least this far below the peak energy are treated as noise. */
export const DEFAULT_NOISE_ENERGY_RATIO = 0.063
export const DEFAULT_WIENER_OVERSUBTRACTION = 1
export const DEFAULT_WIENER_SPECTRAL_FLOOR = 0.12
export const MINIMUM_NOISE_FRAMES_FOR_ESTIMATE = 2

export interface ReduceStationaryNoiseOptions {
  readonly enabled?: boolean
  readonly frameDurationSeconds?: number
  readonly hopDurationSeconds?: number
  readonly noiseEnergyRatio?: number
  readonly oversubtraction?: number
  readonly spectralFloor?: number
}

export function reduceStationaryNoiseFromMonoPcm(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: ReduceStationaryNoiseOptions,
): Float32Array {
  if (options?.enabled === false || samples.length === 0 || sampleRateInHertz <= 0) {
    return samples.slice()
  }

  const frameDurationSeconds =
    options?.frameDurationSeconds ?? DEFAULT_NOISE_REDUCTION_FRAME_SECONDS
  const hopDurationSeconds = options?.hopDurationSeconds ?? DEFAULT_NOISE_REDUCTION_HOP_SECONDS
  const frameLength = Math.max(1, Math.floor(frameDurationSeconds * sampleRateInHertz))
  const hopLength = Math.max(1, Math.floor(hopDurationSeconds * sampleRateInHertz))
  if (samples.length < frameLength * 2) {
    return samples.slice()
  }

  const analysis = analyzeStationaryNoiseFrames(samples, frameLength, hopLength)
  const noisePower = estimateNoisePowerSpectrum(
    analysis,
    options?.noiseEnergyRatio ?? DEFAULT_NOISE_ENERGY_RATIO,
  )
  if (!noisePower) {
    return samples.slice()
  }

  applyWienerGains(
    analysis.frames,
    noisePower,
    options?.oversubtraction ?? DEFAULT_WIENER_OVERSUBTRACTION,
    options?.spectralFloor ?? DEFAULT_WIENER_SPECTRAL_FLOOR,
  )
  return overlapAddFrames(analysis, samples.length)
}

interface ComplexStftFrame {
  readonly real: Float32Array
  readonly imag: Float32Array
  readonly energy: number
}

interface StftAnalysis {
  readonly frames: ComplexStftFrame[]
  readonly window: Float32Array
  readonly frameLength: number
  readonly hopLength: number
  readonly fftSize: number
  readonly starts: number[]
}

function analyzeStationaryNoiseFrames(
  samples: Float32Array,
  frameLength: number,
  hopLength: number,
): StftAnalysis {
  const fftSize = nextPowerOfTwo(frameLength)
  const window = createPeriodicHannWindow(frameLength)
  const frames: ComplexStftFrame[] = []
  const starts: number[] = []
  const lastStart = Math.max(0, samples.length - frameLength)
  for (let start = 0; start <= lastStart; start += hopLength) {
    starts.push(start)
    frames.push(forwardWindowedFrame(samples, start, window, fftSize))
  }
  return { frames, window, frameLength, hopLength, fftSize, starts }
}

function forwardWindowedFrame(
  samples: Float32Array,
  start: number,
  window: Float32Array,
  fftSize: number,
): ComplexStftFrame {
  const real = new Float32Array(fftSize)
  const imag = new Float32Array(fftSize)
  let energy = 0
  for (let index = 0; index < window.length; index += 1) {
    const sample = (samples[start + index] ?? 0) * (window[index] ?? 0)
    real[index] = sample
    energy += sample * sample
  }
  radix2ForwardFft(real, imag)
  return { real, imag, energy }
}

function estimateNoisePowerSpectrum(
  analysis: StftAnalysis,
  noiseEnergyRatio: number,
): Float32Array | null {
  let peakEnergy = 0
  for (const frame of analysis.frames) {
    if (frame.energy > peakEnergy) {
      peakEnergy = frame.energy
    }
  }
  if (!(peakEnergy > 0)) {
    return null
  }

  const quietFrames = analysis.frames.filter(
    (frame) => frame.energy <= peakEnergy * noiseEnergyRatio,
  )
  if (quietFrames.length < MINIMUM_NOISE_FRAMES_FOR_ESTIMATE) {
    return null
  }

  const noisePower = new Float32Array(analysis.fftSize)
  for (const frame of quietFrames) {
    for (let bin = 0; bin < analysis.fftSize; bin += 1) {
      const real = frame.real[bin] ?? 0
      const imag = frame.imag[bin] ?? 0
      noisePower[bin] = (noisePower[bin] ?? 0) + real * real + imag * imag
    }
  }
  const scale = 1 / quietFrames.length
  for (let bin = 0; bin < noisePower.length; bin += 1) {
    noisePower[bin] = (noisePower[bin] ?? 0) * scale
  }
  return noisePower
}

function applyWienerGains(
  frames: readonly ComplexStftFrame[],
  noisePower: Float32Array,
  oversubtraction: number,
  spectralFloor: number,
): void {
  const floor = Math.min(1, Math.max(0, spectralFloor))
  for (const frame of frames) {
    for (let bin = 0; bin < frame.real.length; bin += 1) {
      const real = frame.real[bin] ?? 0
      const imag = frame.imag[bin] ?? 0
      const signalPower = real * real + imag * imag
      const noise = (noisePower[bin] ?? 0) * oversubtraction
      const gain = Math.max(floor, 1 - noise / Math.max(signalPower, 1e-12))
      frame.real[bin] = real * gain
      frame.imag[bin] = imag * gain
    }
  }
}

function overlapAddFrames(analysis: StftAnalysis, outputLength: number): Float32Array {
  const output = new Float32Array(outputLength)
  const timeReal = new Float32Array(analysis.fftSize)
  const timeImag = new Float32Array(analysis.fftSize)

  for (let frameIndex = 0; frameIndex < analysis.frames.length; frameIndex += 1) {
    const frame = analysis.frames[frameIndex]
    const start = analysis.starts[frameIndex]
    if (!frame || start === undefined) {
      continue
    }
    timeReal.set(frame.real)
    timeImag.set(frame.imag)
    radix2InverseFft(timeReal, timeImag)
    for (let index = 0; index < analysis.frameLength; index += 1) {
      const outputIndex = start + index
      if (outputIndex >= outputLength) {
        break
      }
      output[outputIndex] = (output[outputIndex] ?? 0) + (timeReal[index] ?? 0)
    }
  }
  return output
}

/** Periodic Hann so a 50 % hop sums to 1 (COLA). */
function createPeriodicHannWindow(lengthInSamples: number): Float32Array {
  const window = new Float32Array(lengthInSamples)
  if (lengthInSamples <= 1) {
    if (lengthInSamples === 1) {
      window[0] = 1
    }
    return window
  }
  for (let index = 0; index < lengthInSamples; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / lengthInSamples)
  }
  return window
}
