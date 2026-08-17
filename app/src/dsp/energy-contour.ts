/**
 * Frame-wise log-RMS energy contour. Same 25 ms / 10 ms grid as MFCC
 * so energy can be DTW-aligned against a TTS reference (issue #58).
 */

import { computeRootMeanSquareEnergy } from './signal-energy'
import {
  DEFAULT_MFCC_FRAME_DURATION_SECONDS,
  DEFAULT_MFCC_HOP_DURATION_SECONDS,
  MFCC_LOG_MEL_ENERGY_FLOOR,
} from './mfcc-extraction'

export interface EnergyContourOptions {
  readonly frameDurationSeconds?: number
  readonly hopDurationSeconds?: number
}

/** One-dimensional log-RMS frames for DTW. */
export function extractLogRmsEnergyFrames(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: EnergyContourOptions,
): Float32Array[] {
  if (samples.length === 0 || !(sampleRateInHertz > 0)) {
    return []
  }
  const frameDurationSeconds =
    options?.frameDurationSeconds ?? DEFAULT_MFCC_FRAME_DURATION_SECONDS
  const hopDurationSeconds = options?.hopDurationSeconds ?? DEFAULT_MFCC_HOP_DURATION_SECONDS
  const frameLengthInSamples = Math.max(32, Math.floor(frameDurationSeconds * sampleRateInHertz))
  const hopLengthInSamples = Math.max(1, Math.floor(hopDurationSeconds * sampleRateInHertz))
  if (samples.length < frameLengthInSamples) {
    return [logRmsFrame(samples)]
  }
  const frames: Float32Array[] = []
  for (
    let startSample = 0;
    startSample + frameLengthInSamples <= samples.length;
    startSample += hopLengthInSamples
  ) {
    frames.push(logRmsFrame(samples.subarray(startSample, startSample + frameLengthInSamples)))
  }
  return frames
}

function logRmsFrame(frameSamples: Float32Array): Float32Array {
  const rms = computeRootMeanSquareEnergy(frameSamples)
  return Float32Array.of(Math.log(Math.max(rms, MFCC_LOG_MEL_ENERGY_FLOOR)))
}
