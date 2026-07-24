/**
 * Log-magnitude spectrogram for mono PCM (pure domain, no browser APIs).
 * Used for post-utterance visualization (Avance 2 / Señales y Sistemas).
 */

import { createHannWindow, nextPowerOfTwo } from './mfcc-extraction'

/** Default STFT frame length (seconds). */
export const DEFAULT_SPECTROGRAM_FRAME_DURATION_SECONDS = 0.025

/** Default hop between frames (seconds). */
export const DEFAULT_SPECTROGRAM_HOP_DURATION_SECONDS = 0.01

export interface SpectrogramOptions {
  readonly frameDurationSeconds?: number
  readonly hopDurationSeconds?: number
  /** Keep only bins up to this frequency (Hz). Default: min(Nyquist, 8000). */
  readonly maximumFrequencyInHertz?: number
}

export interface SpectrogramResult {
  /**
   * One row per time frame; each row is log10(power + eps) for bins
   * from DC up to the frequency cap (inclusive of the last kept bin).
   */
  readonly frames: readonly Float32Array[]
  readonly sampleRateInHertz: number
  readonly fftSize: number
  readonly hopLengthInSamples: number
  readonly binCount: number
  /** Hertz of the highest kept bin. */
  readonly maximumFrequencyInHertz: number
}

/**
 * Short-time Fourier transform → log-magnitude spectrogram.
 * Empty audio → empty frames array.
 */
export function computeLogMagnitudeSpectrogram(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: SpectrogramOptions,
): SpectrogramResult {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return {
      frames: [],
      sampleRateInHertz,
      fftSize: 0,
      hopLengthInSamples: 0,
      binCount: 0,
      maximumFrequencyInHertz: 0,
    }
  }

  const frameDurationSeconds =
    options?.frameDurationSeconds ?? DEFAULT_SPECTROGRAM_FRAME_DURATION_SECONDS
  const hopDurationSeconds =
    options?.hopDurationSeconds ?? DEFAULT_SPECTROGRAM_HOP_DURATION_SECONDS
  const maximumFrequencyInHertz = Math.min(
    options?.maximumFrequencyInHertz ?? 8000,
    sampleRateInHertz / 2,
  )

  const frameLengthInSamples = Math.max(1, Math.floor(frameDurationSeconds * sampleRateInHertz))
  const hopLengthInSamples = Math.max(1, Math.floor(hopDurationSeconds * sampleRateInHertz))
  const fftSize = nextPowerOfTwo(frameLengthInSamples)
  const fullBinCount = Math.floor(fftSize / 2) + 1
  const maxBinIndex = Math.min(
    fullBinCount - 1,
    Math.max(1, Math.floor((maximumFrequencyInHertz * fftSize) / sampleRateInHertz)),
  )
  const binCount = maxBinIndex + 1
  const window = createHannWindow(frameLengthInSamples)
  const frames: Float32Array[] = []

  if (samples.length < frameLengthInSamples) {
    const padded = new Float32Array(frameLengthInSamples)
    padded.set(samples)
    frames.push(computeLogMagnitudeFrame(padded, window, fftSize, binCount))
  } else {
    for (
      let startSample = 0;
      startSample + frameLengthInSamples <= samples.length;
      startSample += hopLengthInSamples
    ) {
      const frameSamples = samples.subarray(startSample, startSample + frameLengthInSamples)
      frames.push(computeLogMagnitudeFrame(frameSamples, window, fftSize, binCount))
    }
  }

  return {
    frames,
    sampleRateInHertz,
    fftSize,
    hopLengthInSamples,
    binCount,
    maximumFrequencyInHertz: (maxBinIndex * sampleRateInHertz) / fftSize,
  }
}

/**
 * Min/max over all spectrogram cells (for display normalization).
 * Returns null when there are no frames.
 */
export function computeSpectrogramValueRange(
  spectrogram: SpectrogramResult,
): { minimum: number; maximum: number } | null {
  if (spectrogram.frames.length === 0) {
    return null
  }
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (const frame of spectrogram.frames) {
    for (let bin = 0; bin < frame.length; bin += 1) {
      const value = frame[bin] ?? 0
      if (value < minimum) {
        minimum = value
      }
      if (value > maximum) {
        maximum = value
      }
    }
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return null
  }
  return { minimum, maximum }
}

function computeLogMagnitudeFrame(
  frameSamples: ArrayLike<number>,
  window: Float32Array,
  fftSize: number,
  binCount: number,
): Float32Array {
  const windowed = new Float32Array(fftSize)
  const frameLength = Math.min(frameSamples.length, window.length, fftSize)
  for (let index = 0; index < frameLength; index += 1) {
    windowed[index] = (frameSamples[index] ?? 0) * (window[index] ?? 0)
  }

  const real = new Float32Array(fftSize)
  const imag = new Float32Array(fftSize)
  real.set(windowed)
  radix2ForwardFft(real, imag)

  const logMagnitudes = new Float32Array(binCount)
  for (let bin = 0; bin < binCount; bin += 1) {
    const re = real[bin] ?? 0
    const im = imag[bin] ?? 0
    const power = re * re + im * im
    logMagnitudes[bin] = Math.log10(power + 1e-12)
  }
  return logMagnitudes
}

function radix2ForwardFft(real: Float32Array, imag: Float32Array): void {
  const n = real.length
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error(`FFT length must be a power of two, got ${n}`)
  }

  let j = 0
  for (let i = 1; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) {
      j ^= bit
    }
    j ^= bit
    if (i < j) {
      const realTemp = real[i] ?? 0
      real[i] = real[j] ?? 0
      real[j] = realTemp
      const imagTemp = imag[i] ?? 0
      imag[i] = imag[j] ?? 0
      imag[j] = imagTemp
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length
    const wLengthReal = Math.cos(angle)
    const wLengthImag = Math.sin(angle)
    for (let start = 0; start < n; start += length) {
      let wReal = 1
      let wImag = 0
      const half = length >> 1
      for (let offset = 0; offset < half; offset += 1) {
        const evenIndex = start + offset
        const oddIndex = evenIndex + half
        const oddReal = real[oddIndex] ?? 0
        const oddImag = imag[oddIndex] ?? 0
        const tReal = wReal * oddReal - wImag * oddImag
        const tImag = wReal * oddImag + wImag * oddReal
        real[oddIndex] = (real[evenIndex] ?? 0) - tReal
        imag[oddIndex] = (imag[evenIndex] ?? 0) - tImag
        real[evenIndex] = (real[evenIndex] ?? 0) + tReal
        imag[evenIndex] = (imag[evenIndex] ?? 0) + tImag
        const nextWReal = wReal * wLengthReal - wImag * wLengthImag
        wImag = wReal * wLengthImag + wImag * wLengthReal
        wReal = nextWReal
      }
    }
  }
}
