/**
 * Formant estimation via LPC envelope peak-picking (pure domain).
 * F1/F2/F3 for pronunciation feedback (Avance 2 — Señales y Sistemas).
 *
 * Pipeline per frame: pre-emphasis → Hann → autocorrelation → Levinson–Durbin LPC
 * → dense spectral envelope → local maxima as formant candidates.
 */

import { createHannWindow } from './mfcc-extraction'

export const DEFAULT_FORMANT_FRAME_DURATION_SECONDS = 0.03
export const DEFAULT_FORMANT_HOP_DURATION_SECONDS = 0.01
export const DEFAULT_FORMANT_PRE_EMPHASIS = 0.97
/** LPC order rule of thumb ≈ 2 + fs/1000; clamped for stability. */
export const DEFAULT_FORMANT_MINIMUM_FREQUENCY_HZ = 90
export const DEFAULT_FORMANT_MAXIMUM_FREQUENCY_HZ = 4000
export const DEFAULT_FORMANT_MINIMUM_PEAK_SEPARATION_HZ = 250
export const DEFAULT_FORMANT_SPECTRUM_BINS = 512

export interface FormantTriple {
  readonly f1InHertz: number | null
  readonly f2InHertz: number | null
  readonly f3InHertz: number | null
}

export interface FormantContourFrame {
  readonly frameIndex: number
  readonly timeInSeconds: number
  readonly formants: FormantTriple
}

export interface FormantEstimationOptions {
  readonly frameDurationSeconds?: number
  readonly hopDurationSeconds?: number
  readonly lpcOrder?: number
  readonly preEmphasisCoefficient?: number
  readonly minimumFrequencyInHertz?: number
  readonly maximumFrequencyInHertz?: number
  readonly minimumPeakSeparationInHertz?: number
  readonly spectrumBinCount?: number
}

/**
 * Frame-wise formant contour for a mono utterance.
 */
export function extractFormantContour(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: FormantEstimationOptions,
): FormantContourFrame[] {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return []
  }

  const frameDurationSeconds =
    options?.frameDurationSeconds ?? DEFAULT_FORMANT_FRAME_DURATION_SECONDS
  const hopDurationSeconds =
    options?.hopDurationSeconds ?? DEFAULT_FORMANT_HOP_DURATION_SECONDS
  const frameLengthInSamples = Math.max(32, Math.floor(frameDurationSeconds * sampleRateInHertz))
  const hopLengthInSamples = Math.max(1, Math.floor(hopDurationSeconds * sampleRateInHertz))
  const lpcOrder =
    options?.lpcOrder ??
    Math.min(24, Math.max(8, Math.round(2 + sampleRateInHertz / 1000)))
  const preEmphasisCoefficient =
    options?.preEmphasisCoefficient ?? DEFAULT_FORMANT_PRE_EMPHASIS
  const minimumFrequencyInHertz =
    options?.minimumFrequencyInHertz ?? DEFAULT_FORMANT_MINIMUM_FREQUENCY_HZ
  const maximumFrequencyInHertz = Math.min(
    options?.maximumFrequencyInHertz ?? DEFAULT_FORMANT_MAXIMUM_FREQUENCY_HZ,
    sampleRateInHertz / 2 - 50,
  )
  const minimumPeakSeparationInHertz =
    options?.minimumPeakSeparationInHertz ?? DEFAULT_FORMANT_MINIMUM_PEAK_SEPARATION_HZ
  const spectrumBinCount = options?.spectrumBinCount ?? DEFAULT_FORMANT_SPECTRUM_BINS

  const emphasized = applyPreEmphasis(samples, preEmphasisCoefficient)
  const window = createHannWindow(frameLengthInSamples)
  const frames: FormantContourFrame[] = []

  if (emphasized.length < frameLengthInSamples) {
    const padded = new Float32Array(frameLengthInSamples)
    padded.set(emphasized)
    frames.push({
      frameIndex: 0,
      timeInSeconds: 0,
      formants: estimateFormantsInFrame(padded, window, sampleRateInHertz, {
        lpcOrder,
        minimumFrequencyInHertz,
        maximumFrequencyInHertz,
        minimumPeakSeparationInHertz,
        spectrumBinCount,
      }),
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
      formants: estimateFormantsInFrame(frameSamples, window, sampleRateInHertz, {
        lpcOrder,
        minimumFrequencyInHertz,
        maximumFrequencyInHertz,
        minimumPeakSeparationInHertz,
        spectrumBinCount,
      }),
    })
    frameIndex += 1
  }

  return frames
}

/** Median of finite F1/F2/F3 across the contour (robust to unvoiced frames). */
export function computeMedianFormants(
  contour: readonly FormantContourFrame[],
): FormantTriple {
  return {
    f1InHertz: medianOf(contour.map((frame) => frame.formants.f1InHertz)),
    f2InHertz: medianOf(contour.map((frame) => frame.formants.f2InHertz)),
    f3InHertz: medianOf(contour.map((frame) => frame.formants.f3InHertz)),
  }
}

/**
 * Estimate up to three formants in a single windowed frame.
 * Exported for unit tests with synthetic multi-tone energy.
 */
export function estimateFormantsInFrame(
  frameSamples: ArrayLike<number>,
  window: Float32Array,
  sampleRateInHertz: number,
  options: {
    readonly lpcOrder: number
    readonly minimumFrequencyInHertz: number
    readonly maximumFrequencyInHertz: number
    readonly minimumPeakSeparationInHertz: number
    readonly spectrumBinCount: number
  },
): FormantTriple {
  const length = Math.min(frameSamples.length, window.length)
  if (length < options.lpcOrder + 2 || sampleRateInHertz <= 0) {
    return emptyFormants()
  }

  const windowed = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    windowed[index] = (frameSamples[index] ?? 0) * (window[index] ?? 0)
  }

  // Energy gate: skip near-silence frames.
  let energy = 0
  for (let index = 0; index < length; index += 1) {
    const sample = windowed[index] ?? 0
    energy += sample * sample
  }
  if (energy / length < 1e-8) {
    return emptyFormants()
  }

  const autocorrelation = computeAutocorrelation(windowed, options.lpcOrder)
  const lpcCoefficients = levinsonDurbinLpc(autocorrelation, options.lpcOrder)
  if (!lpcCoefficients) {
    return emptyFormants()
  }

  const envelope = computeLpcLogSpectralEnvelope(
    lpcCoefficients,
    options.spectrumBinCount,
  )
  const peakFrequencies = pickSpectralPeaksInHertz(envelope, sampleRateInHertz, {
    minimumFrequencyInHertz: options.minimumFrequencyInHertz,
    maximumFrequencyInHertz: options.maximumFrequencyInHertz,
    minimumPeakSeparationInHertz: options.minimumPeakSeparationInHertz,
    maxPeaks: 3,
  })

  return {
    f1InHertz: peakFrequencies[0] ?? null,
    f2InHertz: peakFrequencies[1] ?? null,
    f3InHertz: peakFrequencies[2] ?? null,
  }
}

/**
 * Pick local maxima on a log spectral envelope (length N → bins 0..N-1 map to 0..Nyquist).
 * Exported for tests.
 */
export function pickSpectralPeaksInHertz(
  logEnvelope: ArrayLike<number>,
  sampleRateInHertz: number,
  options: {
    readonly minimumFrequencyInHertz: number
    readonly maximumFrequencyInHertz: number
    readonly minimumPeakSeparationInHertz: number
    readonly maxPeaks: number
  },
): number[] {
  const binCount = logEnvelope.length
  if (binCount < 3 || sampleRateInHertz <= 0) {
    return []
  }

  const nyquist = sampleRateInHertz / 2
  const minBin = Math.max(
    1,
    Math.floor((options.minimumFrequencyInHertz / nyquist) * (binCount - 1)),
  )
  const maxBin = Math.min(
    binCount - 2,
    Math.ceil((options.maximumFrequencyInHertz / nyquist) * (binCount - 1)),
  )

  type Peak = { bin: number; value: number }
  const candidates: Peak[] = []
  for (let bin = minBin; bin <= maxBin; bin += 1) {
    const previous = logEnvelope[bin - 1] ?? Number.NEGATIVE_INFINITY
    const current = logEnvelope[bin] ?? Number.NEGATIVE_INFINITY
    const next = logEnvelope[bin + 1] ?? Number.NEGATIVE_INFINITY
    if (current > previous && current >= next) {
      candidates.push({ bin, value: current })
    }
  }

  candidates.sort((left, right) => right.value - left.value)

  const selectedBins: number[] = []
  const minBinSeparation = Math.max(
    1,
    Math.round(
      (options.minimumPeakSeparationInHertz / nyquist) * (binCount - 1),
    ),
  )

  for (const candidate of candidates) {
    if (selectedBins.length >= options.maxPeaks) {
      break
    }
    const tooClose = selectedBins.some(
      (selected) => Math.abs(selected - candidate.bin) < minBinSeparation,
    )
    if (!tooClose) {
      selectedBins.push(candidate.bin)
    }
  }

  selectedBins.sort((left, right) => left - right)
  return selectedBins.map((bin) => (bin / (binCount - 1)) * nyquist)
}

/** Levinson–Durbin: autocorrelation r[0..p] → LPC a[1..p] (a[0]=1 implicit). */
export function levinsonDurbinLpc(
  autocorrelation: ArrayLike<number>,
  order: number,
): Float32Array | null {
  if (order < 1 || autocorrelation.length < order + 1) {
    return null
  }
  const r0 = autocorrelation[0] ?? 0
  if (!(r0 > 1e-12)) {
    return null
  }

  const reflection = new Float32Array(order + 1)
  const error = new Float32Array(order + 1)
  const a = new Float32Array(order + 1)
  const aPrevious = new Float32Array(order + 1)
  error[0] = r0

  for (let m = 1; m <= order; m += 1) {
    let acc = autocorrelation[m] ?? 0
    for (let i = 1; i < m; i += 1) {
      acc += (a[i] ?? 0) * (autocorrelation[m - i] ?? 0)
    }
    const km = -acc / (error[m - 1] ?? r0)
    if (!Number.isFinite(km) || Math.abs(km) >= 1) {
      // Unstable reflection coefficient — abort this frame.
      return null
    }
    reflection[m] = km
    a[m] = km
    for (let i = 1; i < m; i += 1) {
      aPrevious[i] = a[i] ?? 0
    }
    for (let i = 1; i < m; i += 1) {
      a[i] = (aPrevious[i] ?? 0) + km * (aPrevious[m - i] ?? 0)
    }
    error[m] = (error[m - 1] ?? r0) * (1 - km * km)
    if ((error[m] ?? 0) <= 1e-14) {
      break
    }
  }

  // Return a[1..order] (prediction coefficients).
  const coefficients = new Float32Array(order)
  for (let i = 0; i < order; i += 1) {
    coefficients[i] = a[i + 1] ?? 0
  }
  return coefficients
}

function computeLpcLogSpectralEnvelope(
  lpcCoefficients: Float32Array,
  binCount: number,
): Float32Array {
  // A(z) = 1 + Σ a_k z^{-k}. Envelope power ∝ 1 / |A(e^{jω})|².
  const envelope = new Float32Array(binCount)
  for (let bin = 0; bin < binCount; bin += 1) {
    const omega = (Math.PI * bin) / (binCount - 1)
    let real = 1
    let imag = 0
    for (let k = 0; k < lpcCoefficients.length; k += 1) {
      const angle = -omega * (k + 1)
      const ak = lpcCoefficients[k] ?? 0
      real += ak * Math.cos(angle)
      imag += ak * Math.sin(angle)
    }
    const magnitudeSquared = real * real + imag * imag
    envelope[bin] = -0.5 * Math.log(Math.max(magnitudeSquared, 1e-12))
  }
  return envelope
}

function computeAutocorrelation(samples: Float32Array, maxLag: number): Float32Array {
  const result = new Float32Array(maxLag + 1)
  for (let lag = 0; lag <= maxLag; lag += 1) {
    let sum = 0
    for (let index = 0; index + lag < samples.length; index += 1) {
      sum += (samples[index] ?? 0) * (samples[index + lag] ?? 0)
    }
    result[lag] = sum
  }
  return result
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

function emptyFormants(): FormantTriple {
  return { f1InHertz: null, f2InHertz: null, f3InHertz: null }
}

function medianOf(values: readonly (number | null)[]): number | null {
  const finite = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  )
  if (finite.length === 0) {
    return null
  }
  finite.sort((left, right) => left - right)
  const mid = Math.floor(finite.length / 2)
  if (finite.length % 2 === 1) {
    return finite[mid]!
  }
  return (finite[mid - 1]! + finite[mid]!) / 2
}
