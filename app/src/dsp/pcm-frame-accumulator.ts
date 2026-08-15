/**
 * Hopping PCM window for live STFT/YIN. Never zero-pads an incomplete frame.
 */

export interface PcmFrameAccumulatorOptions {
  readonly frameLengthInSamples: number
  readonly hopLengthInSamples: number
}

export interface PcmFrameAccumulator {
  push(chunk: Float32Array): Float32Array[]
  pendingSampleCount(): number
}

export function createPcmFrameAccumulator(
  options: PcmFrameAccumulatorOptions,
): PcmFrameAccumulator {
  const frameLength = Math.max(1, Math.floor(options.frameLengthInSamples))
  const hopLength = Math.max(1, Math.floor(options.hopLengthInSamples))
  let pending = new Float32Array(0)

  return {
    push(chunk: Float32Array): Float32Array[] {
      if (chunk.length === 0) {
        return []
      }
      const merged = new Float32Array(pending.length + chunk.length)
      merged.set(pending)
      merged.set(chunk, pending.length)

      const frames: Float32Array[] = []
      let start = 0
      while (start + frameLength <= merged.length) {
        frames.push(merged.slice(start, start + frameLength))
        start += hopLength
      }
      pending = merged.slice(start)
      return frames
    },
    pendingSampleCount(): number {
      return pending.length
    },
  }
}

export function livePcmFrameLengthInSamples(sampleRateInHertz: number): number {
  return Math.max(1, Math.floor(0.025 * sampleRateInHertz))
}

export function livePcmHopLengthInSamples(sampleRateInHertz: number): number {
  return Math.max(1, Math.floor(0.01 * sampleRateInHertz))
}
