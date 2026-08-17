import { describe, expect, it, vi } from 'vitest'
import {
  cloneMediaStreamForAnalysis,
  stopClonedMediaStream,
} from './clone-media-stream-for-analysis'

function fakeTrack() {
  return { kind: 'audio', stop: vi.fn() }
}

function fakeStream(tracks: ReturnType<typeof fakeTrack>[], withClone = true) {
  const stream = {
    getAudioTracks: () => tracks,
    getTracks: () => tracks,
    clone: withClone
      ? () => {
          const clonedTracks = tracks.map(() => fakeTrack())
          return fakeStream(clonedTracks)
        }
      : undefined,
  }
  return stream as unknown as MediaStream
}

describe('cloneMediaStreamForAnalysis', () => {
  it('returns a distinct stream with audio tracks', () => {
    const original = fakeStream([fakeTrack()])
    const cloned = cloneMediaStreamForAnalysis(original)
    expect(cloned).not.toBeNull()
    expect(cloned).not.toBe(original)
    expect(cloned?.getAudioTracks().length).toBe(1)
  })

  it('returns null when clone is missing or has no audio', () => {
    expect(cloneMediaStreamForAnalysis(fakeStream([fakeTrack()], false))).toBeNull()
    const empty = fakeStream([])
    expect(cloneMediaStreamForAnalysis(empty)).toBeNull()
  })
})

describe('stopClonedMediaStream', () => {
  it('stops every track and ignores a null stream', () => {
    const track = fakeTrack()
    stopClonedMediaStream(fakeStream([track]))
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(() => stopClonedMediaStream(null)).not.toThrow()
  })
})
