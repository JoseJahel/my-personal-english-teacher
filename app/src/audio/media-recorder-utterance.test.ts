import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decodeRecordingBlobToMono,
  pickMediaRecorderMimeType,
  startMediaRecorderOnStream,
  stopMediaRecorderToBlob,
} from './media-recorder-utterance'
import { MicrophoneCaptureError } from './microphone-capture-errors'

type FakeEventListener = (event?: unknown) => void

class FakeMediaRecorder {
  static supportedMimeTypes = new Set<string>()
  static isTypeSupported(mimeType: string): boolean {
    return FakeMediaRecorder.supportedMimeTypes.has(mimeType)
  }
  static throwOnConstruct = false
  static throwOnStart = false

  readonly stream: unknown
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  mimeType: string
  readonly startTimeslices: number[] = []
  requestDataCallCount = 0
  stopCallCount = 0
  private readonly listeners = new Map<string, Set<FakeEventListener>>()

  constructor(stream: unknown, options?: { mimeType?: string }) {
    this.stream = stream
    if (FakeMediaRecorder.throwOnConstruct) {
      throw new Error('constructor failure')
    }
    this.mimeType = options?.mimeType ?? ''
  }

  addEventListener(type: string, listener: FakeEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
  }

  dispatch(type: string, event?: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }

  start(timesliceInMilliseconds?: number): void {
    if (FakeMediaRecorder.throwOnStart) {
      throw new Error('start failure')
    }
    this.startTimeslices.push(timesliceInMilliseconds ?? -1)
    this.state = 'recording'
  }

  requestData(): void {
    this.requestDataCallCount += 1
  }

  stop(): void {
    this.stopCallCount += 1
    this.state = 'inactive'
    this.dispatch('stop')
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeMediaRecorder.supportedMimeTypes.clear()
  FakeMediaRecorder.throwOnConstruct = false
  FakeMediaRecorder.throwOnStart = false
})

describe('pickMediaRecorderMimeType', () => {
  it('returns an empty string when MediaRecorder is not defined', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(pickMediaRecorderMimeType()).toBe('')
  })

  it('returns an empty string when no candidate mime type is supported', () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    expect(pickMediaRecorderMimeType()).toBe('')
  })

  it('returns the first supported candidate in priority order', () => {
    FakeMediaRecorder.supportedMimeTypes.add('audio/webm')
    FakeMediaRecorder.supportedMimeTypes.add('audio/mp4')
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    expect(pickMediaRecorderMimeType()).toBe('audio/webm')
  })
})

describe('startMediaRecorderOnStream', () => {
  it('throws a MicrophoneCaptureError when MediaRecorder is not supported', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(() => startMediaRecorderOnStream({} as MediaStream)).toThrow(MicrophoneCaptureError)
  })

  it('starts recording with a 100ms timeslice and returns empty chunks', () => {
    FakeMediaRecorder.supportedMimeTypes.add('audio/webm')
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    const started = startMediaRecorderOnStream({} as MediaStream)
    const fake = started.mediaRecorder as unknown as FakeMediaRecorder
    expect(started.mimeType).toBe('audio/webm')
    expect(started.recordedChunks).toEqual([])
    expect(fake.startTimeslices).toEqual([100])
    expect(fake.state).toBe('recording')
  })

  it('collects only non-empty chunks from dataavailable events', () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    const started = startMediaRecorderOnStream({} as MediaStream)
    const fake = started.mediaRecorder as unknown as FakeMediaRecorder
    const nonEmptyChunk = new Blob(['abc'])
    const emptyChunk = new Blob([])
    fake.dispatch('dataavailable', { data: nonEmptyChunk })
    fake.dispatch('dataavailable', { data: emptyChunk })
    expect(started.recordedChunks).toEqual([nonEmptyChunk])
  })

  it('wraps a constructor failure in a MicrophoneCaptureError', () => {
    FakeMediaRecorder.throwOnConstruct = true
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    expect(() => startMediaRecorderOnStream({} as MediaStream)).toThrow(MicrophoneCaptureError)
  })

  it('wraps a start() failure in a MicrophoneCaptureError', () => {
    FakeMediaRecorder.throwOnStart = true
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    expect(() => startMediaRecorderOnStream({} as MediaStream)).toThrow(MicrophoneCaptureError)
  })
})

describe('stopMediaRecorderToBlob', () => {
  it('resolves immediately when the recorder is already inactive', async () => {
    const fake = new FakeMediaRecorder({} as MediaStream)
    const blob = await stopMediaRecorderToBlob(
      fake as unknown as MediaRecorder,
      [new Blob(['a'])],
      'audio/webm',
    )
    expect(blob.size).toBeGreaterThan(0)
    expect(fake.stopCallCount).toBe(0)
  })

  it('requests remaining data and stops an active recorder before resolving', async () => {
    const fake = new FakeMediaRecorder({} as MediaStream)
    fake.state = 'recording'
    const blob = await stopMediaRecorderToBlob(
      fake as unknown as MediaRecorder,
      [new Blob(['a'])],
      'audio/webm',
    )
    expect(fake.requestDataCallCount).toBe(1)
    expect(fake.stopCallCount).toBe(1)
    expect(blob).toBeInstanceOf(Blob)
  })

  it('still resolves when stop() throws', async () => {
    const fake = new FakeMediaRecorder({} as MediaStream)
    fake.state = 'recording'
    fake.stop = () => {
      throw new Error('stop failure')
    }
    const blob = await stopMediaRecorderToBlob(
      fake as unknown as MediaRecorder,
      [new Blob(['a'])],
      'audio/webm',
    )
    expect(blob).toBeInstanceOf(Blob)
  })

  it('falls back to the given mimeType, then audio/webm, when the recorder has none', async () => {
    const fake = new FakeMediaRecorder({} as MediaStream)
    const blob = await stopMediaRecorderToBlob(fake as unknown as MediaRecorder, [], '')
    expect(blob.type).toBe('audio/webm')
  })
})

describe('decodeRecordingBlobToMono', () => {
  function fakeAudioContext(overrides: Partial<{ state: string; sampleRate: number }> = {}) {
    return {
      state: overrides.state ?? 'running',
      sampleRate: overrides.sampleRate ?? 48000,
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue({
        numberOfChannels: 1,
        length: 3,
        sampleRate: 44100,
        getChannelData: () => new Float32Array([0.1, 0.2, 0.3]),
      }),
    }
  }

  it('returns empty samples without decoding when the blob is empty', async () => {
    const audioContext = fakeAudioContext({ sampleRate: 22050 })
    const result = await decodeRecordingBlobToMono(
      audioContext as unknown as AudioContext,
      new Blob([]),
    )
    expect(result.samples.length).toBe(0)
    expect(result.sampleRate).toBe(22050)
    expect(audioContext.decodeAudioData).not.toHaveBeenCalled()
  })

  it('resumes a suspended context, decodes, and mixes down to mono', async () => {
    const audioContext = fakeAudioContext({ state: 'suspended' })
    const result = await decodeRecordingBlobToMono(
      audioContext as unknown as AudioContext,
      new Blob(['some audio bytes']),
    )
    expect(audioContext.resume).toHaveBeenCalledTimes(1)
    expect(result.samples).toEqual(new Float32Array([0.1, 0.2, 0.3]))
    expect(result.sampleRate).toBe(44100)
  })

  it('does not resume a closed context', async () => {
    const audioContext = fakeAudioContext({ state: 'closed' })
    await decodeRecordingBlobToMono(audioContext as unknown as AudioContext, new Blob(['bytes']))
    expect(audioContext.resume).not.toHaveBeenCalled()
  })
})
