/**
 * RMS energy of a mono PCM signal. Pure domain helper: no browser APIs.
 * Foundation for VAD (silence vs speech) and the capture energy gate.
 */

/**
 * Speech gate after capture (before Whisper).
 * Kept moderate: too low → noise/hallucinations; too high → quiet mics rejected.
 * Floors are slightly permissive so laptop/headset mics at normal volume pass
 * after peak-normalization; trim + Whisper still filter pure noise.
 */
export const MINIMUM_CAPTURE_ENERGY_RMS = 0.0025

/** Peak below this is treated as non-speech (avoids amplifying hiss). */
export const MINIMUM_CAPTURE_PEAK = 0.012

/** Reject captures shorter than this (native-rate seconds). */
export const MINIMUM_CAPTURE_DURATION_SECONDS = 0.28

/**
 * Root-mean-square energy of PCM samples in [-1, 1].
 * Returns 0 for an empty buffer.
 */
export function computeRootMeanSquareEnergy(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0
  }

  let sumOfSquares = 0
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const sampleValue = samples[sampleIndex]
    sumOfSquares += sampleValue * sampleValue
  }

  const meanOfSquares = sumOfSquares / samples.length
  return Math.sqrt(meanOfSquares)
}

/** Maximum absolute sample value. */
export function computePeakAmplitude(samples: Float32Array): number {
  let peakAmplitude = 0
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const absoluteValue = Math.abs(samples[sampleIndex])
    if (absoluteValue > peakAmplitude) {
      peakAmplitude = absoluteValue
    }
  }
  return peakAmplitude
}

/**
 * Whether a capture looks like real speech enough to send to Whisper.
 * Requires duration, RMS, and peak — not just a few noisy samples.
 */
export function hasUsableSpeechEnergy(
  samples: Float32Array,
  sampleRateInHertz: number = 16000,
  options?: {
    readonly minimumRms?: number
    readonly minimumPeak?: number
    readonly minimumDurationSeconds?: number
  },
): boolean {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return false
  }

  const minimumRms = options?.minimumRms ?? MINIMUM_CAPTURE_ENERGY_RMS
  const minimumPeak = options?.minimumPeak ?? MINIMUM_CAPTURE_PEAK
  const minimumDurationSeconds =
    options?.minimumDurationSeconds ?? MINIMUM_CAPTURE_DURATION_SECONDS

  const durationSeconds = samples.length / sampleRateInHertz
  if (durationSeconds < minimumDurationSeconds) {
    return false
  }

  return (
    computeRootMeanSquareEnergy(samples) >= minimumRms &&
    computePeakAmplitude(samples) >= minimumPeak
  )
}
