/**
 * Issue #94: inspect the MFCC chain (power → mel → log → DCT) so a
 * visualization-style scale cannot sneak in between FFT and the filterbank.
 */

import {
  applyMelFilterbank,
  computeLogMelEnergies,
  computeMfccPowerSpectrum,
  createHannWindow,
  createMelFilterbank,
  DEFAULT_MFCC_FRAME_DURATION_SECONDS,
  DEFAULT_MFCC_MEL_FILTER_COUNT,
  DEFAULT_MFCC_MINIMUM_FREQUENCY_HZ,
  DEFAULT_MFCC_PRE_EMPHASIS_COEFFICIENT,
  MFCC_LOG_MEL_ENERGY_FLOOR,
  nextPowerOfTwo,
} from './mfcc-extraction'

export interface MfccChainInspection {
  readonly powerSpectrum: Float32Array
  readonly melEnergies: Float32Array
  readonly logMelEnergies: Float32Array
}

export interface InspectMfccChainOptions {
  /** Test-only: replace |X|² with a poisoned spectrum (e.g. log10 display). */
  readonly powerSpectrumOverride?: Float32Array
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

/**
 * Mid-utterance frame through the same power → mel → ln path as `extractMfccSequence`.
 */
export function inspectMfccChainForTone(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: InspectMfccChainOptions,
): MfccChainInspection {
  const frameLengthInSamples = Math.max(
    1,
    Math.floor(DEFAULT_MFCC_FRAME_DURATION_SECONDS * sampleRateInHertz),
  )
  const fftSize = nextPowerOfTwo(frameLengthInSamples)
  const window = createHannWindow(frameLengthInSamples)
  const filterbank = createMelFilterbank({
    sampleRateInHertz,
    fftSize,
    melFilterCount: DEFAULT_MFCC_MEL_FILTER_COUNT,
    minimumFrequencyInHertz: DEFAULT_MFCC_MINIMUM_FREQUENCY_HZ,
    maximumFrequencyInHertz: sampleRateInHertz / 2,
  })

  const emphasized = applyPreEmphasis(samples, DEFAULT_MFCC_PRE_EMPHASIS_COEFFICIENT)
  const startSample = Math.max(
    0,
    Math.floor((emphasized.length - frameLengthInSamples) / 2),
  )
  const frameSamples = emphasized.subarray(startSample, startSample + frameLengthInSamples)
  const windowed = new Float32Array(fftSize)
  const frameLength = Math.min(frameSamples.length, window.length)
  for (let index = 0; index < frameLength; index += 1) {
    windowed[index] = (frameSamples[index] ?? 0) * (window[index] ?? 0)
  }

  const powerSpectrum = options?.powerSpectrumOverride
    ? options.powerSpectrumOverride.slice()
    : computeMfccPowerSpectrum(windowed)
  const melEnergies = applyMelFilterbank(powerSpectrum, filterbank)
  const logMelEnergies = computeLogMelEnergies(melEnergies)
  return { powerSpectrum, melEnergies, logMelEnergies }
}

export function countFlooredLogMelBands(logMelEnergies: Float32Array): number {
  const floorLog = Math.fround(Math.log(MFCC_LOG_MEL_ENERGY_FLOOR))
  let count = 0
  for (let index = 0; index < logMelEnergies.length; index += 1) {
    if ((logMelEnergies[index] ?? 0) <= floorLog + 1e-5) {
      count += 1
    }
  }
  return count
}

/**
 * Display-style amplitude: coherent-gain 1/N² then log10, as in spectrogram UI.
 * Feeding this to the mel bank as if it were |X|² is the coupling bug #94
 * is written to catch.
 */
export function applyVisualizationLogMagnitudeAsIfPower(
  powerSpectrum: Float32Array,
): Float32Array {
  const fftSize = Math.max(1, (powerSpectrum.length - 1) * 2)
  const nSquared = fftSize * fftSize
  const poisoned = new Float32Array(powerSpectrum.length)
  for (let bin = 0; bin < powerSpectrum.length; bin += 1) {
    poisoned[bin] = Math.log10((powerSpectrum[bin] ?? 0) / nSquared + 1e-12)
  }
  return poisoned
}
