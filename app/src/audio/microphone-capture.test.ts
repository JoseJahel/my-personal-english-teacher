import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openRealMicrophoneStream } from './open-microphone-stream'
import {
  decodeRecordingBlobToMono,
  startMediaRecorderOnStream,
  stopMediaRecorderToBlob,
} from './media-recorder-utterance'
import { trimSpeechSilence } from './trim-speech-silence'
import { normalizePeakAmplitude } from './normalize-peak'
import { startMicrophoneCapture } from './microphone-capture'

vi.mock('./open-microphone-stream', () => ({
  openRealMicrophoneStream: vi.fn(),
}))

vi.mock('./media-recorder-utterance', () => ({
  startMediaRecorderOnStream: vi.fn(),
  stopMediaRecorderToBlob: vi.fn(),
  decodeRecordingBlobToMono: vi.fn(),
}))

vi.mock('./trim-speech-silence', () => ({
  trimSpeechSilence: vi.fn((samples: Float32Array) => samples),
}))

vi.mock('./normalize-peak', () => ({
  DEFAULT_TARGET_PEAK: 0.9,
  normalizePeakAmplitude: vi.fn((samples: Float32Array) => samples),
}))

class FakeAudioNode {
  disconnectCallCount = 0
  connect(destination?: unknown): unknown {
    return destination
  }
  disconnect(): void {
    this.disconnectCallCount += 1
  }
}

class FakeAnalyserNode extends FakeAudioNode {
  fftSize = 0
  smoothingTimeConstant = 0
  minDecibels = 0
  maxDecibels = 0
  timeDomainFillValue = 0.25
  getFloatTimeDomainData(array: Float32Array): void {
    array.fill(this.timeDomainFillValue)
  }
}

class FakeGainNode extends FakeAudioNode {
  gain = { value: 1 }
}

class FakeAudioContext {
  static resumeShouldThrow = false
  static resumeShouldStaySuspended = false
  static instances: FakeAudioContext[] = []

  state: 'suspended' | 'running' | 'closed' = 'suspended'
  sampleRate = 48000
  destination = new FakeAudioNode()
  resumeCallCount = 0
  closeCallCount = 0

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  async resume(): Promise<void> {
    this.resumeCallCount += 1
    if (FakeAudioContext.resumeShouldThrow) {
      throw new Error('resume failed')
    }
    if (!FakeAudioContext.resumeShouldStaySuspended) {
      this.state = 'running'
    }
  }

  async close(): Promise<void> {
    this.closeCallCount += 1
    this.state = 'closed'
  }

  createMediaStreamSource(): FakeAudioNode {
    return new FakeAudioNode()
  }

  createAnalyser(): FakeAnalyserNode {
    return new FakeAnalyserNode()
  }

  createGain(): FakeGainNode {
    return new FakeGainNode()
  }
}

function fakeMicrophoneTrack(overrides: Partial<{ readyState: string; muted: boolean }> = {}) {
  return {
    enabled: false,
    readyState: overrides.readyState ?? 'live',
    muted: overrides.muted ?? false,
    stop: vi.fn(),
  }
}

function fakeMediaStream(tracks: ReturnType<typeof fakeMicrophoneTrack>[]) {
  return {
    getAudioTracks: () => tracks,
    getTracks: () => tracks,
    clone() {
      const clonedTracks = tracks.map((track) => fakeMicrophoneTrack({
        readyState: track.readyState,
        muted: track.muted,
      }))
      return fakeMediaStream(clonedTracks)
    },
  }
}

function fakeStartedRecorder(state: 'inactive' | 'recording' | 'paused' = 'recording') {
  const stop = vi.fn()
  return {
    started: {
      mediaRecorder: { state, stop } as unknown as MediaRecorder,
      mimeType: 'audio/webm',
      recordedChunks: [] as Blob[],
    },
    stop,
  }
}

function mockOpenedStream(track: ReturnType<typeof fakeMicrophoneTrack>) {
  const mediaStream = fakeMediaStream([track])
  const release = vi.fn()
  vi.mocked(openRealMicrophoneStream).mockResolvedValue({
    mediaStream: mediaStream as unknown as MediaStream,
    deviceLabel: 'Test Microphone',
    deviceId: 'device-1',
    usedNativeRecovery: false,
    release,
  })
  return { mediaStream, release }
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeAudioContext)
  FakeAudioContext.instances = []
  FakeAudioContext.resumeShouldThrow = false
  FakeAudioContext.resumeShouldStaySuspended = false
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('startMicrophoneCapture failure paths', () => {
  it('wraps a failure from openRealMicrophoneStream', async () => {
    vi.mocked(openRealMicrophoneStream).mockRejectedValue(new Error('no device'))
    await expect(startMicrophoneCapture()).rejects.toMatchObject({
      name: 'MicrophoneCaptureError',
    })
  })

  it('throws and cleans up when the opened stream has no audio track', async () => {
    const mediaStream = fakeMediaStream([])
    const release = vi.fn()
    vi.mocked(openRealMicrophoneStream).mockResolvedValue({
      mediaStream: mediaStream as unknown as MediaStream,
      deviceLabel: 'Test Microphone',
      deviceId: 'device-1',
      usedNativeRecovery: false,
      release,
    })

    await expect(startMicrophoneCapture()).rejects.toMatchObject({
      message: 'Opened stream has no audio track.',
    })
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('wraps a resume() failure and closes the AudioContext', async () => {
    const track = fakeMicrophoneTrack()
    const { release } = mockOpenedStream(track)
    FakeAudioContext.resumeShouldThrow = true

    await expect(startMicrophoneCapture()).rejects.toMatchObject({
      message: expect.stringContaining('AudioContext could not start'),
    })
    expect(track.stop).toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
    expect(FakeAudioContext.instances[0]?.closeCallCount).toBe(1)
  })

  it('throws when the AudioContext stays suspended after setup', async () => {
    const track = fakeMicrophoneTrack()
    mockOpenedStream(track)
    FakeAudioContext.resumeShouldStaySuspended = true

    await expect(startMicrophoneCapture()).rejects.toMatchObject({
      message: expect.stringContaining('stayed suspended'),
    })
  })

  it('rethrows a startMediaRecorderOnStream failure as-is and cleans up', async () => {
    const track = fakeMicrophoneTrack()
    const { release } = mockOpenedStream(track)
    vi.mocked(startMediaRecorderOnStream).mockImplementation(() => {
      throw new Error('recorder boom')
    })

    await expect(startMicrophoneCapture()).rejects.toThrow('recorder boom')
    expect(track.stop).toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })
})

describe('startMicrophoneCapture happy path', () => {
  it('returns a session with working live meters', async () => {
    const track = fakeMicrophoneTrack()
    mockOpenedStream(track)
    vi.mocked(startMediaRecorderOnStream).mockReturnValue(fakeStartedRecorder('recording').started)

    const session = await startMicrophoneCapture()

    expect(session.deviceLabel).toBe('Test Microphone')
    expect(session.liveAnalysisSourceNode).not.toBe(session.sourceNode)
    expect(session.liveAnalysisSourceNode).toBeTruthy()
    expect(track.enabled).toBe(true)
    const meters = session.readLiveMeters()
    expect(meters.rms).toBeCloseTo(0.25, 5)
    expect(meters.peak).toBeCloseTo(0.25, 5)
    expect(meters.level01).toBeCloseTo(0.25, 5)

    session.abort()
  })

  it('abort() stops an active recorder, disconnects, and closes the context; is idempotent', async () => {
    const track = fakeMicrophoneTrack()
    mockOpenedStream(track)
    const { started, stop: recorderStop } = fakeStartedRecorder('recording')
    vi.mocked(startMediaRecorderOnStream).mockReturnValue(started)

    const session = await startMicrophoneCapture()
    session.abort()
    session.abort()

    expect(recorderStop).toHaveBeenCalledTimes(1)
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(FakeAudioContext.instances[0]?.closeCallCount).toBe(1)
  })

  it('stop() decodes, trims, and normalizes when the recording has data', async () => {
    const track = fakeMicrophoneTrack()
    mockOpenedStream(track)
    vi.mocked(startMediaRecorderOnStream).mockReturnValue(fakeStartedRecorder('recording').started)
    const recordedBlob = new Blob(['some audio bytes'])
    vi.mocked(stopMediaRecorderToBlob).mockResolvedValue(recordedBlob)
    const decodedSamples = new Float32Array([0.1, 0.2, 0.3])
    vi.mocked(decodeRecordingBlobToMono).mockResolvedValue({
      samples: decodedSamples,
      sampleRate: 16000,
    })

    const session = await startMicrophoneCapture()
    const result = await session.stop()

    expect(trimSpeechSilence).toHaveBeenCalled()
    expect(normalizePeakAmplitude).toHaveBeenCalled()
    expect(result.samples).toEqual(decodedSamples)
    expect(result.sampleRate).toBe(16000)
    expect(result.diagnostics.source).toBe('media-recorder')
    expect(result.diagnostics.mediaRecorderBlobBytes).toBe(recordedBlob.size)
    expect(track.stop).toHaveBeenCalled()
  })

  it('stop() returns an empty, source "none" result when the recording is empty', async () => {
    const track = fakeMicrophoneTrack()
    mockOpenedStream(track)
    vi.mocked(startMediaRecorderOnStream).mockReturnValue(fakeStartedRecorder('recording').started)
    vi.mocked(stopMediaRecorderToBlob).mockResolvedValue(new Blob([]))

    const session = await startMicrophoneCapture()
    const result = await session.stop()

    expect(decodeRecordingBlobToMono).not.toHaveBeenCalled()
    expect(result.samples.length).toBe(0)
    expect(result.diagnostics.source).toBe('none')
  })

  it('stop() falls back to an empty "none" result when decoding throws', async () => {
    const track = fakeMicrophoneTrack()
    mockOpenedStream(track)
    vi.mocked(startMediaRecorderOnStream).mockReturnValue(fakeStartedRecorder('recording').started)
    vi.mocked(stopMediaRecorderToBlob).mockResolvedValue(new Blob(['bytes']))
    vi.mocked(decodeRecordingBlobToMono).mockRejectedValue(new Error('decode failure'))

    const session = await startMicrophoneCapture()
    const result = await session.stop()

    expect(result.samples.length).toBe(0)
    expect(result.diagnostics.source).toBe('none')
  })

  it('stop() after abort() returns an empty result immediately without touching the recorder', async () => {
    const track = fakeMicrophoneTrack()
    mockOpenedStream(track)
    vi.mocked(startMediaRecorderOnStream).mockReturnValue(fakeStartedRecorder('recording').started)

    const session = await startMicrophoneCapture()
    session.abort()
    const result = await session.stop()

    expect(stopMediaRecorderToBlob).not.toHaveBeenCalled()
    expect(result.samples.length).toBe(0)
    expect(result.diagnostics.source).toBe('none')
  })
})
