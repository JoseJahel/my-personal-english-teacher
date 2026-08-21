import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TextToAudioPipeline } from '@huggingface/transformers'
import { modelRegistry } from './model-registry'
import {
  DEFAULT_TUTOR_VOICE_ID,
  MAXIMUM_TTS_INPUT_CHARACTERS,
  normalizeTextToSpeechPipelineOutput,
  prepareTextForSpeechSynthesis,
  preloadTutorVoiceEmbeddings,
  resetPreloadedTutorVoiceEmbeddingsForTests,
  synthesizeSpeechFromText,
  tutorVoiceEmbeddingsUrl,
  TutorVoiceEmbeddingsPreloadError,
} from './text-to-speech-synthesis'

/** Minimal fake of the Fetch `Response` shape our preload code reads. */
function fakeFetchResponse(bytes: Float32Array, ok = true, status = 200) {
  return {
    ok,
    status,
    arrayBuffer: async () => bytes.buffer.slice(0),
    clone() {
      return fakeFetchResponse(bytes, ok, status)
    },
  }
}

/** Minimal fake of the Cache Storage `Cache` interface. */
function fakeCacheStorage() {
  const store = new Map<string, ReturnType<typeof fakeFetchResponse>>()
  const cache = {
    match: vi.fn(async (url: string) => store.get(url)),
    put: vi.fn(async (url: string, response: ReturnType<typeof fakeFetchResponse>) => {
      store.set(url, response)
    }),
  }
  return { cache, open: vi.fn(async () => cache) }
}

describe('prepareTextForSpeechSynthesis', () => {
  it('returns empty for blank input', () => {
    expect(prepareTextForSpeechSynthesis('   ')).toBe('')
    expect(prepareTextForSpeechSynthesis('')).toBe('')
  })

  it('collapses internal whitespace', () => {
    expect(prepareTextForSpeechSynthesis('  Hello,   world  ')).toBe('Hello, world')
  })

  it('truncates to the maximum character budget', () => {
    const longText = 'a'.repeat(MAXIMUM_TTS_INPUT_CHARACTERS + 50)
    const prepared = prepareTextForSpeechSynthesis(longText)
    expect(prepared.length).toBeLessThanOrEqual(MAXIMUM_TTS_INPUT_CHARACTERS)
  })

  it('normalizes numbers, prices, and codes before returning (#77)', () => {
    expect(prepareTextForSpeechSynthesis('Gate B12 boards at 3:30 p.m., ticket is $12')).toBe(
      'Gate B twelve boards at three thirty p m, ticket is twelve dollars',
    )
  })
})

describe('normalizeTextToSpeechPipelineOutput', () => {
  it('copies Float32Array audio and keeps sample rate', () => {
    const audio = new Float32Array([0.1, -0.2, 0.3])
    const result = normalizeTextToSpeechPipelineOutput({
      audio,
      sampling_rate: 16000,
    })
    expect(result.sampleRateInHertz).toBe(16000)
    expect(result.samples).toEqual(audio)
    expect(result.samples).not.toBe(audio)
  })

  it('defaults sample rate when the value is non-positive', () => {
    const result = normalizeTextToSpeechPipelineOutput({
      audio: new Float32Array([0, 1, 0]),
      sampling_rate: 0,
    })
    expect(result.samples).toEqual(new Float32Array([0, 1, 0]))
    expect(result.sampleRateInHertz).toBe(16000)
  })

  it('returns empty samples for empty pipeline output', () => {
    const result = normalizeTextToSpeechPipelineOutput([])
    expect(result.samples.length).toBe(0)
  })
})

describe('tutorVoiceEmbeddingsUrl', () => {
  it('pins the F1 tutor voice to the registry revision SHA', () => {
    const url = tutorVoiceEmbeddingsUrl()
    expect(url).toContain(modelRegistry.textToSpeech.huggingFaceModelId)
    expect(url).toContain(modelRegistry.textToSpeech.revision)
    expect(url).toContain(`/voices/${DEFAULT_TUTOR_VOICE_ID}.bin`)
  })
})

describe('preloadTutorVoiceEmbeddings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetPreloadedTutorVoiceEmbeddingsForTests()
  })

  it('fetches the pinned voice once, persists it to the transformers-cache bucket, and decodes it', async () => {
    const bytes = new Float32Array([1, 2, 3, 4])
    const { cache, open } = fakeCacheStorage()
    vi.stubGlobal('caches', { open })
    const fetchMock = vi.fn(async () => fakeFetchResponse(bytes))
    vi.stubGlobal('fetch', fetchMock)

    const result = await preloadTutorVoiceEmbeddings()

    expect(result).toEqual(bytes)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(tutorVoiceEmbeddingsUrl())
    expect(open).toHaveBeenCalledWith('transformers-cache')
    expect(cache.put).toHaveBeenCalledWith(tutorVoiceEmbeddingsUrl(), expect.anything())
  })

  it('reuses the in-memory copy on a second call instead of fetching again', async () => {
    const bytes = new Float32Array([5, 6, 7])
    const { open } = fakeCacheStorage()
    vi.stubGlobal('caches', { open })
    const fetchMock = vi.fn(async () => fakeFetchResponse(bytes))
    vi.stubGlobal('fetch', fetchMock)

    await preloadTutorVoiceEmbeddings()
    await preloadTutorVoiceEmbeddings()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reuses a cached browser-cache entry without refetching from the network', async () => {
    const bytes = new Float32Array([9, 9])
    const { cache, open } = fakeCacheStorage()
    await cache.put(tutorVoiceEmbeddingsUrl(), fakeFetchResponse(bytes))
    vi.stubGlobal('caches', { open })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await preloadTutorVoiceEmbeddings()

    expect(result).toEqual(bytes)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still fetches and decodes when the Cache Storage API is unavailable', async () => {
    vi.stubGlobal('caches', undefined)
    const bytes = new Float32Array([1, 1, 1])
    const fetchMock = vi.fn(async () => fakeFetchResponse(bytes))
    vi.stubGlobal('fetch', fetchMock)

    const result = await preloadTutorVoiceEmbeddings()

    expect(result).toEqual(bytes)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('wraps a failed download in a typed error instead of failing silently', async () => {
    vi.stubGlobal('caches', undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeFetchResponse(new Float32Array(), false, 404)),
    )

    await expect(preloadTutorVoiceEmbeddings()).rejects.toBeInstanceOf(
      TutorVoiceEmbeddingsPreloadError,
    )
  })
})

describe('synthesizeSpeechFromText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetPreloadedTutorVoiceEmbeddingsForTests()
  })

  it('hands the pipeline the preloaded Float32Array instead of the voice URL', async () => {
    const bytes = new Float32Array([1, 2, 3])
    const { open } = fakeCacheStorage()
    vi.stubGlobal('caches', { open })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeFetchResponse(bytes)),
    )
    await preloadTutorVoiceEmbeddings()

    const synthesizer = vi.fn(async () => ({
      audio: new Float32Array([0]),
      sampling_rate: 16000,
    })) as unknown as TextToAudioPipeline

    await synthesizeSpeechFromText(synthesizer, 'Hello there.')

    expect(synthesizer).toHaveBeenCalledWith(
      'Hello there.',
      expect.objectContaining({ speaker_embeddings: bytes }),
    )
  })

  it('falls back to the voice URL when nothing has been preloaded', async () => {
    const synthesizer = vi.fn(async () => ({
      audio: new Float32Array([0]),
      sampling_rate: 16000,
    })) as unknown as TextToAudioPipeline

    await synthesizeSpeechFromText(synthesizer, 'Hello there.')

    expect(synthesizer).toHaveBeenCalledWith(
      'Hello there.',
      expect.objectContaining({ speaker_embeddings: tutorVoiceEmbeddingsUrl() }),
    )
  })
})
