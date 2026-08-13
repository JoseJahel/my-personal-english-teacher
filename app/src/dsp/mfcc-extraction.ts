/**
 * Mel-frequency cepstral coefficients (MFCC) — pure domain, no browser APIs.
 * Spec defaults match project design: Hann 25 ms, hop 10 ms, 13 coeffs, 40 mel filters.
 * Foundation for pronunciation comparison (DTW over MFCC sequences).
 */

import { radix2ForwardFft } from './radix2-forward-fft'

/** Analysis frame length (seconds). */
export const DEFAULT_MFCC_FRAME_DURATION_SECONDS = 0.025

/** Hop between successive frames (seconds). */
export const DEFAULT_MFCC_HOP_DURATION_SECONDS = 0.01

/** Number of mel filterbank channels. */
export const DEFAULT_MFCC_MEL_FILTER_COUNT = 40

/** Number of cepstral coefficients returned per frame (including c0). */
export const DEFAULT_MFCC_COEFFICIENT_COUNT = 13

/** Pre-emphasis coefficient y[n] = x[n] − α·x[n−1]. */
export const DEFAULT_MFCC_PRE_EMPHASIS_COEFFICIENT = 0.97

/** Lowest mel-filter edge (Hz). */
export const DEFAULT_MFCC_MINIMUM_FREQUENCY_HZ = 0

/**
 * Highest mel-filter edge (Hz). When omitted, uses Nyquist (sampleRate / 2).
 * At 16 kHz that is 8 kHz — standard for speech MFCC.
 */

export interface MfccExtractionOptions {
  readonly frameDurationSeconds?: number
  readonly hopDurationSeconds?: number
  readonly melFilterCount?: number
  readonly coefficientCount?: number
  readonly preEmphasisCoefficient?: number
  readonly minimumFrequencyInHertz?: number
  readonly maximumFrequencyInHertz?: number
}

export interface MfccFrame {
  readonly frameIndex: number
  readonly timeInSeconds: number
  /** Length = coefficientCount (c0 … c_{N−1}). */
  readonly coefficients: Float32Array
}

/** Hertz → mel (HTK / Slaney-compatible log formula used widely in speech). */
export function hertzToMel(frequencyInHertz: number): number {
  return 2595 * Math.log10(1 + frequencyInHertz / 700)
}

/** Mel → hertz (inverse of {@link hertzToMel}). */
export function melToHertz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1)
}

/** Next power of two ≥ n (minimum 1). */
export function nextPowerOfTwo(value: number): number {
  if (value <= 1) {
    return 1
  }
  let power = 1
  while (power < value) {
    power <<= 1
  }
  return power
}

/** Periodic Hann window of the given length. */
export function createHannWindow(lengthInSamples: number): Float32Array {
  const window = new Float32Array(lengthInSamples)
  if (lengthInSamples <= 1) {
    if (lengthInSamples === 1) {
      window[0] = 1
    }
    return window
  }
  for (let index = 0; index < lengthInSamples; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (lengthInSamples - 1))
  }
  return window
}

/**
 * Build a triangular mel filterbank matrix: shape [melFilterCount][fftBinCount].
 * `fftBinCount` is the number of unique non-negative FFT bins (N/2 + 1).
 */
export function createMelFilterbank(options: {
  readonly sampleRateInHertz: number
  readonly fftSize: number
  readonly melFilterCount: number
  readonly minimumFrequencyInHertz: number
  readonly maximumFrequencyInHertz: number
}): Float32Array[] {
  const {
    sampleRateInHertz,
    fftSize,
    melFilterCount,
    minimumFrequencyInHertz,
    maximumFrequencyInHertz,
  } = options

  const fftBinCount = Math.floor(fftSize / 2) + 1
  const minimumMel = hertzToMel(minimumFrequencyInHertz)
  const maximumMel = hertzToMel(maximumFrequencyInHertz)
  const melPoints = new Float32Array(melFilterCount + 2)
  for (let index = 0; index < melPoints.length; index += 1) {
    melPoints[index] =
      minimumMel + (index * (maximumMel - minimumMel)) / (melFilterCount + 1)
  }

  const binCenters = new Float32Array(melPoints.length)
  for (let index = 0; index < melPoints.length; index += 1) {
    const frequencyInHertz = melToHertz(melPoints[index] ?? 0)
    binCenters[index] = Math.floor(((fftSize + 1) * frequencyInHertz) / sampleRateInHertz)
  }

  const filterbank: Float32Array[] = []
  for (let filterIndex = 0; filterIndex < melFilterCount; filterIndex += 1) {
    const weights = new Float32Array(fftBinCount)
    const left = binCenters[filterIndex] ?? 0
    const center = binCenters[filterIndex + 1] ?? 0
    const right = binCenters[filterIndex + 2] ?? 0

    for (let bin = left; bin < center; bin += 1) {
      if (bin >= 0 && bin < fftBinCount && center !== left) {
        weights[bin] = (bin - left) / (center - left)
      }
    }
    for (let bin = center; bin < right; bin += 1) {
      if (bin >= 0 && bin < fftBinCount && right !== center) {
        weights[bin] = (right - bin) / (right - center)
      }
    }
    filterbank.push(weights)
  }

  return filterbank
}

/**
 * Extract the MFCC sequence for a mono utterance.
 * Returns one vector per frame (c0 … c_{N−1}).
 */
export function extractMfccSequence(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: MfccExtractionOptions,
): MfccFrame[] {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return []
  }

  const frameDurationSeconds =
    options?.frameDurationSeconds ?? DEFAULT_MFCC_FRAME_DURATION_SECONDS
  const hopDurationSeconds = options?.hopDurationSeconds ?? DEFAULT_MFCC_HOP_DURATION_SECONDS
  const melFilterCount = options?.melFilterCount ?? DEFAULT_MFCC_MEL_FILTER_COUNT
  const coefficientCount = options?.coefficientCount ?? DEFAULT_MFCC_COEFFICIENT_COUNT
  const preEmphasisCoefficient =
    options?.preEmphasisCoefficient ?? DEFAULT_MFCC_PRE_EMPHASIS_COEFFICIENT
  const minimumFrequencyInHertz =
    options?.minimumFrequencyInHertz ?? DEFAULT_MFCC_MINIMUM_FREQUENCY_HZ
  const maximumFrequencyInHertz =
    options?.maximumFrequencyInHertz ?? sampleRateInHertz / 2

  if (
    frameDurationSeconds <= 0 ||
    hopDurationSeconds <= 0 ||
    melFilterCount < 1 ||
    coefficientCount < 1 ||
    maximumFrequencyInHertz <= minimumFrequencyInHertz
  ) {
    return []
  }

  const frameLengthInSamples = Math.max(1, Math.floor(frameDurationSeconds * sampleRateInHertz))
  const hopLengthInSamples = Math.max(1, Math.floor(hopDurationSeconds * sampleRateInHertz))
  const fftSize = nextPowerOfTwo(frameLengthInSamples)
  const window = createHannWindow(frameLengthInSamples)
  const filterbank = createMelFilterbank({
    sampleRateInHertz,
    fftSize,
    melFilterCount,
    minimumFrequencyInHertz,
    maximumFrequencyInHertz,
  })

  const emphasized = applyPreEmphasis(samples, preEmphasisCoefficient)
  const frames: MfccFrame[] = []

  if (emphasized.length < frameLengthInSamples) {
    const padded = new Float32Array(frameLengthInSamples)
    padded.set(emphasized)
    frames.push({
      frameIndex: 0,
      timeInSeconds: 0,
      coefficients: computeMfccCoefficientsForFrame(
        padded,
        window,
        fftSize,
        filterbank,
        coefficientCount,
      ),
    })
    return frames
  }

  let frameIndex = 0
  for (
    let startSample = 0;
    startSample + frameLengthInSamples <= emphasized.length;
    startSample += hopLengthInSamples
  ) {
    const frameSamples = emphasized.subarray(startSample, startSample + frameLengthInSamples)
    frames.push({
      frameIndex,
      timeInSeconds: startSample / sampleRateInHertz,
      coefficients: computeMfccCoefficientsForFrame(
        frameSamples,
        window,
        fftSize,
        filterbank,
        coefficientCount,
      ),
    })
    frameIndex += 1
  }

  return frames
}

/** Euclidean distance between two equal-length MFCC vectors (helper for DTW later). */
export function computeMfccVectorEuclideanDistance(
  left: Float32Array,
  right: Float32Array,
): number {
  const length = Math.min(left.length, right.length)
  let sumOfSquares = 0
  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0)
    sumOfSquares += delta * delta
  }
  return Math.sqrt(sumOfSquares)
}

function applyPreEmphasis(samples: Float32Array, coefficient: number): Float32Array {
  if (coefficient === 0 || samples.length === 0) {
    return samples
  }
  const output = new Float32Array(samples.length)
  output[0] = samples[0] ?? 0
  for (let index = 1; index < samples.length; index += 1) {
    output[index] = (samples[index] ?? 0) - coefficient * (samples[index - 1] ?? 0)
  }
  return output
}

function computeMfccCoefficientsForFrame(
  frameSamples: Float32Array,
  window: Float32Array,
  fftSize: number,
  filterbank: readonly Float32Array[],
  coefficientCount: number,
): Float32Array {
  const windowed = new Float32Array(fftSize)
  const frameLength = Math.min(frameSamples.length, window.length)
  for (let index = 0; index < frameLength; index += 1) {
    windowed[index] = (frameSamples[index] ?? 0) * (window[index] ?? 0)
  }

  const powerSpectrum = computePowerSpectrum(windowed)
  const melEnergies = applyMelFilterbank(powerSpectrum, filterbank)
  const logMelEnergies = new Float32Array(melEnergies.length)
  for (let index = 0; index < melEnergies.length; index += 1) {
    // Floor avoids log(0); 1e-10 is standard in speech toolkits.
    logMelEnergies[index] = Math.log(Math.max(melEnergies[index] ?? 0, 1e-10))
  }

  return discreteCosineTransformType2(logMelEnergies, coefficientCount)
}

function applyMelFilterbank(
  powerSpectrum: Float32Array,
  filterbank: readonly Float32Array[],
): Float32Array {
  const energies = new Float32Array(filterbank.length)
  for (let filterIndex = 0; filterIndex < filterbank.length; filterIndex += 1) {
    const weights = filterbank[filterIndex] ?? new Float32Array(0)
    let energy = 0
    const binLimit = Math.min(weights.length, powerSpectrum.length)
    for (let bin = 0; bin < binLimit; bin += 1) {
      energy += (powerSpectrum[bin] ?? 0) * (weights[bin] ?? 0)
    }
    energies[filterIndex] = energy
  }
  return energies
}

/**
 * Type-II DCT (ortho-unnormalized, HTK-style scaling for MFCC):
 * c[k] = Σ_m logE[m] · cos(π·k·(m+0.5)/M)
 */
function discreteCosineTransformType2(
  logMelEnergies: Float32Array,
  coefficientCount: number,
): Float32Array {
  const melCount = logMelEnergies.length
  const coefficients = new Float32Array(coefficientCount)
  for (let k = 0; k < coefficientCount; k += 1) {
    let sum = 0
    for (let m = 0; m < melCount; m += 1) {
      sum += (logMelEnergies[m] ?? 0) * Math.cos((Math.PI * k * (m + 0.5)) / melCount)
    }
    coefficients[k] = sum
  }
  return coefficients
}

/**
 * Real power spectrum |X[k]|² for k = 0..N/2 via in-place radix-2 FFT.
 * Input is zero-padded real frame of length fftSize.
 */
function computePowerSpectrum(realTimeDomain: Float32Array): Float32Array {
  const fftSize = realTimeDomain.length
  const real = new Float32Array(fftSize)
  const imag = new Float32Array(fftSize)
  real.set(realTimeDomain)
  radix2ForwardFft(real, imag)

  const binCount = Math.floor(fftSize / 2) + 1
  const power = new Float32Array(binCount)
  for (let bin = 0; bin < binCount; bin += 1) {
    const re = real[bin] ?? 0
    const im = imag[bin] ?? 0
    power[bin] = re * re + im * im
  }
  return power
}
