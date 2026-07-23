import { describe, expect, it } from 'vitest'
import { concatenateAudioFrames } from './audio-frame-buffer'

describe('concatenateAudioFrames', () => {
  it('returns an empty array when there are no frames', () => {
    const concatenated = concatenateAudioFrames([])

    expect(concatenated.length).toBe(0)
  })

  it('returns a copy with the same values for a single frame', () => {
    const singleFrame = new Float32Array([0.1, -0.2, 0.3])
    const originalFirstValue = singleFrame[0]

    const concatenated = concatenateAudioFrames([singleFrame])

    expect(Array.from(concatenated)).toEqual(Array.from(singleFrame))
    // Result is a copy: mutating the source must not affect it.
    singleFrame[0] = 999
    expect(concatenated[0]).toBe(originalFirstValue)
  })

  it('preserves order and values when concatenating several frames', () => {
    const firstFrame = new Float32Array([1, 2, 3])
    const secondFrame = new Float32Array([4, 5])
    const thirdFrame = new Float32Array([6, 7, 8, 9])

    const concatenated = concatenateAudioFrames([firstFrame, secondFrame, thirdFrame])

    expect(Array.from(concatenated)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('ignores empty frames without changing the result', () => {
    const emptyFrame = new Float32Array(0)
    const firstFrame = new Float32Array([0.5, -0.5])
    const secondFrame = new Float32Array([0.25])

    const concatenated = concatenateAudioFrames([emptyFrame, firstFrame, emptyFrame, secondFrame])

    expect(Array.from(concatenated)).toEqual([0.5, -0.5, 0.25])
  })

  it('result length equals the sum of input lengths', () => {
    const frames = [new Float32Array(128), new Float32Array(128), new Float32Array(64)]

    const concatenated = concatenateAudioFrames(frames)

    expect(concatenated.length).toBe(320)
  })
})
