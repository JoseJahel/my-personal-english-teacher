import { afterEach, describe, expect, it, vi } from 'vitest'
import { playMonoPcmSamples } from './play-pcm-mono'

class FakeAudioBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  readonly channels: Float32Array[]

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels
    this.length = length
    this.sampleRate = sampleRate
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }

  copyToChannel(source: Float32Array, channelIndex: number): void {
    this.channels[channelIndex].set(source)
  }
}

class FakeBufferSourceNode {
  buffer: FakeAudioBuffer | null = null
  onended: (() => void) | null = null
  startCalls: number[] = []
  stopCallCount = 0
  connectedTo: unknown = null
  shouldThrowOnStart = false

  connect(destination: unknown): void {
    this.connectedTo = destination
  }

  start(when: number): void {
    this.startCalls.push(when)
    if (this.shouldThrowOnStart) {
      throw new Error('start failure')
    }
  }

  stop(): void {
    this.stopCallCount += 1
    this.onended?.()
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  static nextSourceShouldThrowOnStart = false

  state: 'suspended' | 'running' | 'closed' = 'running'
  currentTime = 0
  resumeCallCount = 0
  closeCallCount = 0
  readonly destination = {}
  lastCreatedBuffer: FakeAudioBuffer | null = null
  lastCreatedSource: FakeBufferSourceNode | null = null

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  async resume(): Promise<void> {
    this.resumeCallCount += 1
    this.state = 'running'
  }

  async close(): Promise<void> {
    this.closeCallCount += 1
    this.state = 'closed'
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeAudioBuffer {
    const buffer = new FakeAudioBuffer(channels, length, sampleRate)
    this.lastCreatedBuffer = buffer
    return buffer
  }

  createBufferSource(): FakeBufferSourceNode {
    const source = new FakeBufferSourceNode()
    source.shouldThrowOnStart = FakeAudioContext.nextSourceShouldThrowOnStart
    this.lastCreatedSource = source
    return source
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeAudioContext.instances = []
  FakeAudioContext.nextSourceShouldThrowOnStart = false
})

describe('playMonoPcmSamples early returns', () => {
  it('resolves immediately for empty samples without touching AudioContext', async () => {
    const audioContextConstructor = vi.fn()
    vi.stubGlobal('AudioContext', audioContextConstructor)
    await expect(playMonoPcmSamples(new Float32Array(0), 16000)).resolves.toEqual({
      completed: true,
      cutoffMs: 0,
    })
    expect(audioContextConstructor).not.toHaveBeenCalled()
  })

  it('resolves immediately for a non-positive sample rate', async () => {
    const audioContextConstructor = vi.fn()
    vi.stubGlobal('AudioContext', audioContextConstructor)
    await expect(playMonoPcmSamples(new Float32Array([0.1, 0.2]), 0)).resolves.toEqual({
      completed: true,
      cutoffMs: 0,
    })
    expect(audioContextConstructor).not.toHaveBeenCalled()
  })

  it('resolves immediately without starting playback when already aborted', async () => {
    const audioContextConstructor = vi.fn()
    vi.stubGlobal('AudioContext', audioContextConstructor)
    const controller = new AbortController()
    controller.abort()
    const result = await playMonoPcmSamples(new Float32Array([0.1, 0.2]), 16000, {
      signal: controller.signal,
    })
    expect(result).toEqual({ completed: false, cutoffMs: 0 })
    expect(audioContextConstructor).not.toHaveBeenCalled()
  })
})

describe('playMonoPcmSamples context ownership', () => {
  it('creates its own AudioContext when none is provided and closes it afterwards', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const samples = new Float32Array([0.1, -0.1, 0.2])
    const playbackPromise = playMonoPcmSamples(samples, 16000)
    const created = await vi.waitFor(() => {
      const instance = FakeAudioContext.instances.at(-1)
      if (!instance?.lastCreatedSource) throw new Error('not ready')
      return instance
    })
    created.currentTime = samples.length / 16000
    created.lastCreatedSource!.onended?.()
    await playbackPromise
    expect(created.closeCallCount).toBe(1)
  })

  it('reuses a provided AudioContext and does not close it', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'running'
    const samples = new Float32Array([0.3, -0.3])
    const playbackPromise = playMonoPcmSamples(samples, 16000, {
      audioContext: audioContext as unknown as AudioContext,
    })
    await vi.waitFor(() => {
      if (!audioContext.lastCreatedSource) throw new Error('not ready')
    })
    audioContext.currentTime = samples.length / 16000
    audioContext.lastCreatedSource!.onended?.()
    await playbackPromise
    expect(audioContext.closeCallCount).toBe(0)
  })
})

describe('playMonoPcmSamples resume behavior', () => {
  it('resumes a suspended context before creating the buffer source', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'suspended'
    const samples = new Float32Array([0.1])
    const playbackPromise = playMonoPcmSamples(samples, 16000, {
      audioContext: audioContext as unknown as AudioContext,
    })
    await vi.waitFor(() => {
      if (!audioContext.lastCreatedSource) throw new Error('not ready')
    })
    expect(audioContext.resumeCallCount).toBe(1)
    audioContext.lastCreatedSource!.onended?.()
    await playbackPromise
  })

  it('does not resume an already-running context', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'running'
    const samples = new Float32Array([0.1])
    const playbackPromise = playMonoPcmSamples(samples, 16000, {
      audioContext: audioContext as unknown as AudioContext,
    })
    await vi.waitFor(() => {
      if (!audioContext.lastCreatedSource) throw new Error('not ready')
    })
    expect(audioContext.resumeCallCount).toBe(0)
    audioContext.lastCreatedSource!.onended?.()
    await playbackPromise
  })
})

describe('playMonoPcmSamples playback', () => {
  it('copies samples into channel 0 of a mono buffer and starts at time 0', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'running'
    const samples = new Float32Array([0.5, -0.5, 0.25])
    const playbackPromise = playMonoPcmSamples(samples, 22050, {
      audioContext: audioContext as unknown as AudioContext,
    })
    await vi.waitFor(() => {
      if (!audioContext.lastCreatedSource) throw new Error('not ready')
    })
    expect(audioContext.lastCreatedBuffer?.numberOfChannels).toBe(1)
    expect(audioContext.lastCreatedBuffer?.length).toBe(3)
    expect(audioContext.lastCreatedBuffer?.sampleRate).toBe(22050)
    expect(audioContext.lastCreatedBuffer?.channels[0]).toEqual(samples)
    expect(audioContext.lastCreatedSource?.startCalls).toEqual([0])
    audioContext.currentTime = samples.length / 22050
    audioContext.lastCreatedSource!.onended?.()
    await playbackPromise
  })

  it('rejects when start() throws and still closes an owned AudioContext', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    FakeAudioContext.nextSourceShouldThrowOnStart = true
    const samples = new Float32Array([0.1])
    await expect(playMonoPcmSamples(samples, 16000)).rejects.toThrow('start failure')
    expect(FakeAudioContext.instances.at(-1)?.closeCallCount).toBe(1)
  })

  it('reports completed: true with the full duration when playback ends naturally', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'running'
    const sampleRate = 16000
    const samples = new Float32Array(sampleRate)
    const playbackPromise = playMonoPcmSamples(samples, sampleRate, {
      audioContext: audioContext as unknown as AudioContext,
    })
    await vi.waitFor(() => {
      if (!audioContext.lastCreatedSource) throw new Error('not ready')
    })
    audioContext.currentTime = 1
    audioContext.lastCreatedSource!.onended?.()
    const result = await playbackPromise
    expect(result.completed).toBe(true)
    expect(result.cutoffMs).toBe(1000)
  })
})

describe('playMonoPcmSamples interruption (barge-in, issue #46)', () => {
  it('stops playback and reports completed: false with a partial cutoffMs when aborted mid-utterance', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'running'
    const sampleRate = 16000
    const samples = new Float32Array(sampleRate * 2)
    const controller = new AbortController()
    const playbackPromise = playMonoPcmSamples(samples, sampleRate, {
      audioContext: audioContext as unknown as AudioContext,
      signal: controller.signal,
    })
    const source = await vi.waitFor(() => {
      if (!audioContext.lastCreatedSource) throw new Error('not ready')
      return audioContext.lastCreatedSource
    })
    audioContext.currentTime = 0.75
    controller.abort()
    const result = await playbackPromise
    expect(source.stopCallCount).toBe(1)
    expect(result.completed).toBe(false)
    expect(result.cutoffMs).toBe(750)
  })

  it('never reports a cutoffMs beyond the clip duration even if the clock overshoots', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'running'
    const sampleRate = 16000
    const samples = new Float32Array(sampleRate)
    const controller = new AbortController()
    const playbackPromise = playMonoPcmSamples(samples, sampleRate, {
      audioContext: audioContext as unknown as AudioContext,
      signal: controller.signal,
    })
    await vi.waitFor(() => {
      if (!audioContext.lastCreatedSource) throw new Error('not ready')
    })
    audioContext.currentTime = 5
    controller.abort()
    const result = await playbackPromise
    expect(result.cutoffMs).toBe(1000)
  })

  it('ignores an abort that fires after playback already ended', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'running'
    const sampleRate = 16000
    const samples = new Float32Array(sampleRate)
    const controller = new AbortController()
    const playbackPromise = playMonoPcmSamples(samples, sampleRate, {
      audioContext: audioContext as unknown as AudioContext,
      signal: controller.signal,
    })
    const source = await vi.waitFor(() => {
      if (!audioContext.lastCreatedSource) throw new Error('not ready')
      return audioContext.lastCreatedSource
    })
    audioContext.currentTime = 1
    source.onended?.()
    const result = await playbackPromise
    controller.abort()
    expect(result.completed).toBe(true)
    expect(source.stopCallCount).toBe(0)
  })

  it('resolves immediately with completed: false when the signal is already aborted before start', async () => {
    const audioContext = new FakeAudioContext()
    audioContext.state = 'running'
    const controller = new AbortController()
    controller.abort()
    const samples = new Float32Array([0.1, 0.2])
    const result = await playMonoPcmSamples(samples, 16000, {
      audioContext: audioContext as unknown as AudioContext,
      signal: controller.signal,
    })
    expect(result).toEqual({ completed: false, cutoffMs: 0 })
    expect(audioContext.lastCreatedSource).toBeNull()
  })
})
