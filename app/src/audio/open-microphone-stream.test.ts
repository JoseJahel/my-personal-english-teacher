import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isGetUserMediaNative,
  isSyntheticTrackLabel,
  openRealMicrophoneStream,
} from './open-microphone-stream'
import { MicrophoneCaptureError } from './microphone-capture-errors'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isSyntheticTrackLabel', () => {
  it('flags MediaStreamAudioDestinationNode labels', () => {
    expect(isSyntheticTrackLabel('MediaStreamAudioDestinationNode')).toBe(true)
    expect(isSyntheticTrackLabel('mediastreamaudiodestinationnode (lowercase)')).toBe(true)
  })

  it('flags Functional Test Array labels', () => {
    expect(isSyntheticTrackLabel('Microphone (Functional Test Array)')).toBe(true)
  })

  it('accepts a normal device label', () => {
    expect(isSyntheticTrackLabel('Built-in Microphone')).toBe(false)
  })
})

describe('isGetUserMediaNative', () => {
  it('returns true when getUserMedia looks like a native function', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: Array.prototype.push },
    })
    expect(isGetUserMediaNative()).toBe(true)
  })

  it('returns false for a plain JS function', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: () => {} },
    })
    expect(isGetUserMediaNative()).toBe(false)
  })

  it('returns false when mediaDevices is missing', () => {
    vi.stubGlobal('navigator', {})
    expect(isGetUserMediaNative()).toBe(false)
  })
})

function fakeAudioTrack(
  overrides: Partial<{
    label: string
    deviceId: string
    applyConstraints: (constraints: unknown) => Promise<void>
  }> = {},
) {
  return {
    label: overrides.label ?? 'Built-in Microphone',
    enabled: false,
    getSettings: () => ({ deviceId: overrides.deviceId ?? 'default-device' }),
    applyConstraints: overrides.applyConstraints ?? vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  }
}

function fakeMediaStream(tracks: ReturnType<typeof fakeAudioTrack>[]) {
  return {
    getAudioTracks: () => tracks,
    getTracks: () => tracks,
  }
}

describe('openRealMicrophoneStream', () => {
  it('throws when the browser exposes no getUserMedia at all', async () => {
    vi.stubGlobal('navigator', { mediaDevices: {} })
    await expect(openRealMicrophoneStream()).rejects.toBeInstanceOf(MicrophoneCaptureError)
  })

  it('returns the opened stream on the first successful attempt', async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined)
    const track = fakeAudioTrack({ label: 'USB Mic', deviceId: 'usb-1', applyConstraints })
    const stream = fakeMediaStream([track])
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    })

    const opened = await openRealMicrophoneStream()

    expect(opened.mediaStream).toBe(stream)
    expect(opened.deviceLabel).toBe('USB Mic')
    expect(opened.deviceId).toBe('usb-1')
    expect(typeof opened.release).toBe('function')
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(applyConstraints).toHaveBeenCalledWith(
      expect.objectContaining({ echoCancellation: true, noiseSuppression: true }),
    )
    expect(track.enabled).toBe(true)
  })

  it('throws immediately on permission-denied without retrying other constraint sets', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    })

    const rejection = openRealMicrophoneStream()
    await expect(rejection).rejects.toBeInstanceOf(MicrophoneCaptureError)
    await expect(rejection).rejects.toMatchObject({ reason: 'permission-denied' })
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('rejects synthetic-labeled streams and eventually throws after exhausting attempts', async () => {
    const syntheticTrack = fakeAudioTrack({ label: 'Microphone (Functional Test Array)' })
    const syntheticStream = fakeMediaStream([syntheticTrack])
    const getUserMedia = vi.fn().mockResolvedValue(syntheticStream)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    })

    await expect(openRealMicrophoneStream()).rejects.toBeInstanceOf(MicrophoneCaptureError)
    expect(getUserMedia).toHaveBeenCalledTimes(3)
    expect(syntheticTrack.stop).toHaveBeenCalled()
  })

  it('throws when the stream has no audio track at all', async () => {
    const emptyStream = fakeMediaStream([])
    const getUserMedia = vi.fn().mockResolvedValue(emptyStream)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
    })

    await expect(openRealMicrophoneStream()).rejects.toBeInstanceOf(MicrophoneCaptureError)
  })
})
