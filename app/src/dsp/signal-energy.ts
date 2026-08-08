/**
 * RMS energy of a mono PCM signal. Pure domain helper: no browser APIs.
 * Foundation for VAD (silence vs speech) and the capture energy gate.
 */

/**
 * Speech gate after capture (before Whisper).
 * Kept moderate: too low -> noise/hallucinations; too high -> quiet mics rejected.
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
 * Returns 0 for an empty buffer. Non-finite samples (NaN/Infinity), which can
 * appear from a corrupted decode or a driver glitch, are treated as silence
 * (0 contribution) instead of poisoning the whole result.
 */
export function computeRootMeanSquareEnergy(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0
  }
  let sumOfSquares = 0
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const sampleValue = samples[sampleIndex]
    if (!Number.isFinite(sampleValue)) {
      continue
    }
    sumOfSquares += sampleValue * sampleValue
  }
  const meanOfSquares = sumOfSquares / samples.length
  return Math.sqrt(meanOfSquares)
}

/**
 * Maximum absolute sample value. Non-finite samples are ignored so a single
 * corrupted sample cannot report a false (or infinite) peak.
 */
export function computePeakAmplitude(samples: Float32Array): number {
  let peakAmplitude = 0
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const sampleValue = samples[sampleIndex]
    if (!Number.isFinite(sampleValue)) {
      continue
    }
    const absoluteValue = Math.abs(sampleValue)
    if (absoluteValue > peakAmplitude) {
      peakAmplitude = absoluteValue
    }
  }
  return peakAmplitude
}

/**
 * Replaces non-finite samples (NaN/Infinity/-Infinity) with silence (0).
 * Meant to run once, as early as possible in the capture pipeline, so every
 * downstream consumer (energy gate, trim, normalize, MFCC, Whisper) only
 * ever sees finite PCM data.
 */
export function sanitizeNonFiniteSamples(samples: Float32Array): Float32Array {
  const sanitized = new Float32Array(samples.length)
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const sampleValue = samples[sampleIndex]
    sanitized[sampleIndex] = Number.isFinite(sampleValue) ? sampleValue : 0
  }
  return sanitized
}

/**
 * Whether a capture looks like real speech enough to send to Whisper.
 * Requires duration, RMS, and peak -- not just a few noisy samples.
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
