import { describe, expect, it } from 'vitest'
import { createPcmFrameAccumulator } from './pcm-frame-accumulator'

describe('createPcmFrameAccumulator', () => {
  it('emits no frame until a full window is available (no zero-pad)', () => {
    const accumulator = createPcmFrameAccumulator({
      frameLengthInSamples: 400,
      hopLengthInSamples: 160,
    })
    expect(accumulator.push(new Float32Array(399))).toHaveLength(0)
    expect(accumulator.pendingSampleCount()).toBe(399)
  })

  it('emits frames on hop boundaries and keeps the unpadded remainder', () => {
    const accumulator = createPcmFrameAccumulator({
      frameLengthInSamples: 4,
      hopLengthInSamples: 2,
    })
    const frames = accumulator.push(new Float32Array([1, 2, 3, 4, 5, 6]))
    expect(frames).toHaveLength(2)
    expect(Array.from(frames[0]!)).toEqual([1, 2, 3, 4])
    expect(Array.from(frames[1]!)).toEqual([3, 4, 5, 6])
    expect(accumulator.pendingSampleCount()).toBe(2)
  })

  it('does not invent samples when the remainder is shorter than a frame', () => {
    const accumulator = createPcmFrameAccumulator({
      frameLengthInSamples: 4,
      hopLengthInSamples: 2,
    })
    accumulator.push(new Float32Array([1, 2, 3, 4, 5, 6]))
    expect(accumulator.push(new Float32Array([7]))).toHaveLength(0)
    expect(accumulator.pendingSampleCount()).toBe(3)
  })
})
