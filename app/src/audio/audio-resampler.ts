/**
 * Pure linear resampler from device rate (44.1/48 kHz) to 16 kHz mono for Whisper.
 * No anti-aliasing low-pass yet -- accepted for Avance 1 prototype latency.
 */
/**
 * Linear-interpolation resample of mono PCM samples.
 * Returns empty array when `samples` is empty, or when either sample rate is
 * not a finite positive number (a malformed rate would otherwise divide by
 * zero and attempt to allocate an infinite-length array, crashing with a
 * RangeError).
 */
export function resampleAudioSamples(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (samples.length === 0) {
    return new Float32Array(0)
  }
  if (
    !Number.isFinite(inputSampleRate) ||
    inputSampleRate <= 0 ||
    !Number.isFinite(outputSampleRate) ||
    outputSampleRate <= 0
  ) {
    return new Float32Array(0)
  }
  if (inputSampleRate === outputSampleRate) {
    return samples.slice()
  }
  const resamplingRatio = outputSampleRate / inputSampleRate
  const outputSampleCount = Math.max(1, Math.round(samples.length * resamplingRatio))
  const resampledSamples = new Float32Array(outputSampleCount)
  const lastInputSampleIndex = samples.length - 1
  for (let outputIndex = 0; outputIndex < outputSampleCount; outputIndex += 1) {
    const inputPosition = outputIndex / resamplingRatio
    const previousSampleIndex = Math.min(Math.floor(inputPosition), lastInputSampleIndex)
    const nextSampleIndex = Math.min(previousSampleIndex + 1, lastInputSampleIndex)
    const interpolationFraction = inputPosition - previousSampleIndex
    const previousSampleValue = samples[previousSampleIndex]
    const nextSampleValue = samples[nextSampleIndex]
    resampledSamples[outputIndex] =
      previousSampleValue + (nextSampleValue - previousSampleValue) * interpolationFraction
  }
  return resampledSamples
}
/** Sample rate required by Whisper (and the future MFCC path). */
export const WHISPER_SAMPLE_RATE_IN_HERTZ = 16000
/** Shortcut: resample mono PCM to Whisper's 16 kHz rate. */
export function resampleToWhisperRate(
  samples: Float32Array,
  inputSampleRate: number,
): Float32Array {
  return resampleAudioSamples(samples, inputSampleRate, WHISPER_SAMPLE_RATE_IN_HERTZ)
}
