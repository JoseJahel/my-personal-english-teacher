/**
 * Device-rate → 16 kHz for Whisper/MFCC (issue #92).
 * 48 kHz and 44.1 kHz use the linear-phase FIR in dsp/polyphase-resample.ts.
 * Any other pair keeps the Avance 1 linear interpolator (documented fallback).
 */

import {
  FIR_44K1_INPUT_RATE_HZ,
  FIR_48K_INPUT_RATE_HZ,
  FIR_OUTPUT_RATE_HZ,
  decimate48kHzTo16kHz,
  resample44k1To16kHz,
} from '../dsp/polyphase-resample'

/** Sample rate required by Whisper (and the MFCC / score path). */
export const WHISPER_SAMPLE_RATE_IN_HERTZ = FIR_OUTPUT_RATE_HZ

function isCloseToSampleRate(rate: number, target: number): boolean {
  if (!Number.isFinite(rate) || !Number.isFinite(target) || target <= 0) {
    return false
  }
  return Math.abs(rate - target) <= Math.max(50, target * 0.002)
}

function hasUsableSampleRates(inputSampleRate: number, outputSampleRate: number): boolean {
  return (
    Number.isFinite(inputSampleRate) &&
    inputSampleRate > 0 &&
    Number.isFinite(outputSampleRate) &&
    outputSampleRate > 0
  )
}

/**
 * Linear interpolation only. Used as fallback when the pair is not 44.1/48 → 16,
 * and in tests that compare alias leakage against the FIR.
 */
export function resampleAudioSamplesLinear(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  const resamplingRatio = outputSampleRate / inputSampleRate
  const outputSampleCount = Math.max(1, Math.round(samples.length * resamplingRatio))
  const resampledSamples = new Float32Array(outputSampleCount)
  const lastInputSampleIndex = samples.length - 1
  for (let outputIndex = 0; outputIndex < outputSampleCount; outputIndex += 1) {
    const inputPosition = outputIndex / resamplingRatio
    const previousSampleIndex = Math.min(Math.floor(inputPosition), lastInputSampleIndex)
    const nextSampleIndex = Math.min(previousSampleIndex + 1, lastInputSampleIndex)
    const interpolationFraction = inputPosition - previousSampleIndex
    const previousSampleValue = samples[previousSampleIndex] ?? 0
    const nextSampleValue = samples[nextSampleIndex] ?? 0
    resampledSamples[outputIndex] =
      previousSampleValue + (nextSampleValue - previousSampleValue) * interpolationFraction
  }
  return resampledSamples
}

/**
 * Resample mono PCM. Empty / non-finite rates return an empty buffer (no throw).
 */
export function resampleAudioSamples(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (samples.length === 0 || !hasUsableSampleRates(inputSampleRate, outputSampleRate)) {
    return new Float32Array(0)
  }
  if (inputSampleRate === outputSampleRate) {
    return samples.slice()
  }
  if (isCloseToSampleRate(outputSampleRate, WHISPER_SAMPLE_RATE_IN_HERTZ)) {
    if (isCloseToSampleRate(inputSampleRate, FIR_48K_INPUT_RATE_HZ)) {
      return decimate48kHzTo16kHz(samples)
    }
    if (isCloseToSampleRate(inputSampleRate, FIR_44K1_INPUT_RATE_HZ)) {
      return resample44k1To16kHz(samples)
    }
  }
  return resampleAudioSamplesLinear(samples, inputSampleRate, outputSampleRate)
}

/** Shortcut: resample mono PCM to Whisper's 16 kHz rate. */
export function resampleToWhisperRate(
  samples: Float32Array,
  inputSampleRate: number,
): Float32Array {
  return resampleAudioSamples(samples, inputSampleRate, WHISPER_SAMPLE_RATE_IN_HERTZ)
}
