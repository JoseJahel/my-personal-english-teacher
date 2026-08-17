import { describe, expect, it, vi } from 'vitest'
import { startLivePcmSignalViews } from './start-live-pcm-signal-views'

vi.mock('../audio/start-pcm-tap', () => ({
  startPcmTap: vi.fn(async () => {
    throw new Error('startPcmTap must not run without a real worklet source')
  }),
}))

describe('startLivePcmSignalViews', () => {
  it('is a no-op when the source cannot connect', async () => {
    const stop = await startLivePcmSignalViews({
      audioContext: {} as AudioContext,
      sourceNode: {} as AudioNode,
      spectrogramCanvas: null,
      pitchTrackCanvas: null,
    })
    expect(stop).toEqual(expect.any(Function))
    expect(() => stop()).not.toThrow()
  })

  it('is a no-op when the AudioContext has no worklet', async () => {
    const sourceNode = { connect() {}, disconnect() {} } as unknown as AudioNode
    const stop = await startLivePcmSignalViews({
      audioContext: { audioWorklet: undefined } as unknown as AudioContext,
      sourceNode,
      spectrogramCanvas: null,
      pitchTrackCanvas: null,
    })
    expect(() => stop()).not.toThrow()
  })
})
