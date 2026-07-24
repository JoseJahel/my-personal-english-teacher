/**
 * Peak-normalize mono PCM so moderately quiet mics still reach Whisper.
 * Pure helper: no browser APIs.
 *
 * Never applies huge gain to near-silence: that turns room noise into
 * Whisper hallucinations like "(phone ringing)" or "(dramatic music)".
 */

/** Do not boost signals quieter than this peak (noise floor). */
export const MINIMUM_PEAK_FOR_NORMALIZATION = 0.012

/** Cap amplification so noise cannot be scaled hundreds of times. */
export const MAXIMUM_NORMALIZATION_GAIN = 14

/** Default target peak for Whisper (slightly below full scale). */
export const DEFAULT_TARGET_PEAK = 0.85

/**
 * Scale samples toward `targetPeak` when the current peak is below it,
 * only if the peak is already speech-like (>= MINIMUM_PEAK_FOR_NORMALIZATION)
 * and only with gain <= MAXIMUM_NORMALIZATION_GAIN.
 */
export function normalizePeakAmplitude(
  samples: Float32Array,
  targetPeak: number = DEFAULT_TARGET_PEAK,
  options?: {
    readonly minimumPeakForNormalization?: number
    readonly maximumGain?: number
  },
): Float32Array {
  const minimumPeakForNormalization =
    options?.minimumPeakForNormalization ?? MINIMUM_PEAK_FOR_NORMALIZATION
  const maximumGain = options?.maximumGain ?? MAXIMUM_NORMALIZATION_GAIN

  if (samples.length === 0 || targetPeak <= 0) {
    return samples.length === 0 ? new Float32Array(0) : samples.slice()
  }

  let peakAmplitude = 0
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const absoluteValue = Math.abs(samples[sampleIndex]!)
    if (absoluteValue > peakAmplitude) {
      peakAmplitude = absoluteValue
    }
  }

  // Too quiet to be speech: leave unchanged (caller should reject as low energy).
  if (peakAmplitude < minimumPeakForNormalization) {
    return samples.slice()
  }

  if (peakAmplitude >= targetPeak * 0.95) {
    return samples.slice()
  }

  const unrestrictedGain = targetPeak / peakAmplitude
  const gain = Math.min(unrestrictedGain, maximumGain)
  if (gain <= 1.02) {
    return samples.slice()
  }

  const normalizedSamples = new Float32Array(samples.length)
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    normalizedSamples[sampleIndex] = samples[sampleIndex]! * gain
  }
  return normalizedSamples
}
