import { describe, expect, it } from 'vitest'
import { mixAudioBufferChannelsToMono } from './mix-to-mono'
import type { ChannelAudioBuffer } from './mix-to-mono'

function fakeBuffer(channels: Float32Array[]): ChannelAudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    getChannelData: (channelIndex: number) => channels[channelIndex],
  }
}

describe('mixAudioBufferChannelsToMono', () => {
  it('returns an empty array for a buffer with no channels', () => {
    const empty: ChannelAudioBuffer = {
      numberOfChannels: 0,
      length: 0,
      getChannelData: () => new Float32Array(0),
    }
    expect(mixAudioBufferChannelsToMono(empty).length).toBe(0)
  })

  it('returns a copy of the single channel when already mono', () => {
    const mono = new Float32Array([0.1, -0.2, 0.3])
    const mixed = mixAudioBufferChannelsToMono(fakeBuffer([mono]))
    expect(mixed).toEqual(new Float32Array([0.1, -0.2, 0.3]))
    mono[0] = 9
    expect(mixed[0]).toBeCloseTo(0.1, 5)
  })

  it('averages stereo channels sample by sample', () => {
    const left = new Float32Array([1, 0, -1])
    const right = new Float32Array([0, 1, 1])
    const mixed = mixAudioBufferChannelsToMono(fakeBuffer([left, right]))
    expect(mixed[0]).toBeCloseTo(0.5, 5)
    expect(mixed[1]).toBeCloseTo(0.5, 5)
    expect(mixed[2]).toBeCloseTo(0, 5)
  })
})
