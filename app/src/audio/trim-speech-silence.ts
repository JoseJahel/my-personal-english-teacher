/**
 * Trim leading/trailing low-energy frames from a mono capture.
 * Helps whisper-tiny.en: long silence before/after speech hurts recognition.
 * Pure helper: no browser APIs.
 */

import { computeRootMeanSquareEnergy } from '../dsp/signal-energy'

/** Frame length for energy analysis (~20 ms at 16 kHz). */
export const DEFAULT_TRIM_FRAME_MS = 20

/** Keep this much padding around detected speech. */
export const DEFAULT_TRIM_PAD_MS = 120

/**
 * Absolute RMS floor: frames quieter than this are never treated as speech
 * when the whole clip is soft.
 */
export const DEFAULT_TRIM_ABSOLUTE_RMS_FLOOR = 0.004

/**
 * Relative threshold: speech = frames with RMS >= ratio * maxFrameRms.
 * 0.12 keeps quiet consonants while dropping room noise tails.
 */
export const DEFAULT_TRIM_RELATIVE_RMS_RATIO = 0.12

export interface TrimSpeechSilenceOptions {
  readonly frameDurationMs?: number
  readonly padMs?: number
  readonly absoluteRmsFloor?: number
  readonly relativeRmsRatio?: number
}

/**
 * Returns a subarray (copy) of the speech region, or the original copy if
 * no speech-like frames are found (caller still applies energy gates).
 */
export function trimSpeechSilence(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: TrimSpeechSilenceOptions,
): Float32Array {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return new Float32Array(0)
  }

  const frameDurationMs = options?.frameDurationMs ?? DEFAULT_TRIM_FRAME_MS
  const padMs = options?.padMs ?? DEFAULT_TRIM_PAD_MS
  const absoluteRmsFloor = options?.absoluteRmsFloor ?? DEFAULT_TRIM_ABSOLUTE_RMS_FLOOR
  const relativeRmsRatio = options?.relativeRmsRatio ?? DEFAULT_TRIM_RELATIVE_RMS_RATIO

  const frameSampleCount = Math.max(1, Math.round((sampleRateInHertz * frameDurationMs) / 1000))
  const frameCount = Math.floor(samples.length / frameSampleCount)
  if (frameCount < 2) {
    return samples.slice()
  }

  const frameRms: number[] = []
  let maxFrameRms = 0
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * frameSampleCount
    const frame = samples.subarray(start, start + frameSampleCount)
    const rms = computeRootMeanSquareEnergy(frame)
    frameRms.push(rms)
    if (rms > maxFrameRms) {
      maxFrameRms = rms
    }
  }

  const speechThreshold = Math.max(absoluteRmsFloor, maxFrameRms * relativeRmsRatio)
  let firstSpeechFrame = -1
  let lastSpeechFrame = -1
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    if (frameRms[frameIndex]! >= speechThreshold) {
      if (firstSpeechFrame < 0) {
        firstSpeechFrame = frameIndex
      }
      lastSpeechFrame = frameIndex
    }
  }

  // No speech-like frames: return full clip unchanged (energy gate decides later).
  if (firstSpeechFrame < 0 || lastSpeechFrame < 0) {
    return samples.slice()
  }

  const padFrames = Math.max(0, Math.round(padMs / frameDurationMs))
  const startFrame = Math.max(0, firstSpeechFrame - padFrames)
  const endFrame = Math.min(frameCount - 1, lastSpeechFrame + padFrames)
  const startSample = startFrame * frameSampleCount
  // Include any remainder after the last full frame when we keep the end.
  const endSampleExclusive =
    endFrame >= frameCount - 1
      ? samples.length
      : Math.min(samples.length, (endFrame + 1) * frameSampleCount)

  if (startSample <= 0 && endSampleExclusive >= samples.length) {
    return samples.slice()
  }

  return samples.slice(startSample, endSampleExclusive)
}
