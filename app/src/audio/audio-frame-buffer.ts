/**
 * Pure helper: concatenate mono AudioWorklet frames into one continuous buffer.
 */

/** Joins frames in order; empty input yields an empty Float32Array. */
export function concatenateAudioFrames(frames: Float32Array[]): Float32Array {
  const totalSampleCount = frames.reduce((sum, frame) => sum + frame.length, 0)
  const concatenatedSamples = new Float32Array(totalSampleCount)

  let writeOffset = 0
  for (const frame of frames) {
    concatenatedSamples.set(frame, writeOffset)
    writeOffset += frame.length
  }

  return concatenatedSamples
}
