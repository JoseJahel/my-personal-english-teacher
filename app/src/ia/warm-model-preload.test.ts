import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetPreloadedTutorVoiceEmbeddingsForTests } from './text-to-speech-synthesis'
import { isWarmPreloadSuccessful, runWarmModelPreload } from './warm-model-preload'

describe('runWarmModelPreload', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetPreloadedTutorVoiceEmbeddingsForTests()
  })

  it('starts ASR, grammar, TTS, and the tutor voice together instead of waiting in series', async () => {
    const startedAt: string[] = []
    const loadSpeechRecognizer = vi.fn(async () => {
      startedAt.push('asr')
      await Promise.resolve()
    })
    const loadGrammarCorrector = vi.fn(async () => {
      startedAt.push('grammar')
      await Promise.resolve()
    })
    const loadTextToSpeech = vi.fn(async () => {
      startedAt.push('tts')
      await Promise.resolve()
    })
    const loadTutorVoiceEmbeddings = vi.fn(async () => {
      startedAt.push('voice')
      await Promise.resolve()
    })

    const result = await runWarmModelPreload({
      loadSpeechRecognizer,
      loadGrammarCorrector,
      loadTextToSpeech,
      loadTutorVoiceEmbeddings,
    })

    expect(startedAt).toEqual(['asr', 'grammar', 'tts', 'voice'])
    expect(result).toEqual({
      asrReady: true,
      grammarReady: true,
      ttsReady: true,
      voiceEmbeddingsReady: true,
    })
    expect(isWarmPreloadSuccessful(result)).toBe(true)
  })

  it('still succeeds when only TTS fails so the first utterance can transcribe', async () => {
    const result = await runWarmModelPreload({
      loadSpeechRecognizer: async () => undefined,
      loadGrammarCorrector: async () => undefined,
      loadTextToSpeech: async () => {
        throw new Error('vocoder missing')
      },
      loadTutorVoiceEmbeddings: async () => undefined,
    })

    expect(result.asrReady).toBe(true)
    expect(result.ttsReady).toBe(false)
    expect(isWarmPreloadSuccessful(result)).toBe(true)
  })

  it('fails the warm preload when ASR cannot load', async () => {
    const result = await runWarmModelPreload({
      loadSpeechRecognizer: async () => {
        throw new Error('no adapter')
      },
      loadGrammarCorrector: async () => undefined,
      loadTextToSpeech: async () => undefined,
      loadTutorVoiceEmbeddings: async () => undefined,
    })

    expect(isWarmPreloadSuccessful(result)).toBe(false)
  })

  it('degrades without breaking the turn when the tutor voice preload fails, and logs it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await runWarmModelPreload({
      loadSpeechRecognizer: async () => undefined,
      loadGrammarCorrector: async () => undefined,
      loadTextToSpeech: async () => undefined,
      loadTutorVoiceEmbeddings: async () => {
        throw new Error('offline')
      },
    })

    expect(result.voiceEmbeddingsReady).toBe(false)
    expect(isWarmPreloadSuccessful(result)).toBe(true)
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Tutor voice embeddings preload failed'),
      expect.any(Error),
    )
  })

  it('falls back to the real tutor voice preload when no loader is supplied', async () => {
    // Stub a failing `fetch` so the real `preloadTutorVoiceEmbeddings` runs
    // (proving the default-loader wiring fires) without touching the network.
    const fetchMock = vi.fn(async () => {
      throw new Error('network unavailable in test')
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await runWarmModelPreload({
      loadSpeechRecognizer: async () => undefined,
      loadGrammarCorrector: async () => undefined,
      loadTextToSpeech: async () => undefined,
    })

    expect(fetchMock).toHaveBeenCalled()
    expect(result.voiceEmbeddingsReady).toBe(false)
  })
})
