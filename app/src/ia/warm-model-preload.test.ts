import { describe, expect, it, vi } from 'vitest'
import { isWarmPreloadSuccessful, runWarmModelPreload } from './warm-model-preload'

describe('runWarmModelPreload', () => {
  it('starts ASR, grammar, and TTS together instead of waiting in series', async () => {
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

    const result = await runWarmModelPreload({
      loadSpeechRecognizer,
      loadGrammarCorrector,
      loadTextToSpeech,
    })

    expect(startedAt).toEqual(['asr', 'grammar', 'tts'])
    expect(result).toEqual({ asrReady: true, grammarReady: true, ttsReady: true })
    expect(isWarmPreloadSuccessful(result)).toBe(true)
  })

  it('still succeeds when only TTS fails so the first utterance can transcribe', async () => {
    const result = await runWarmModelPreload({
      loadSpeechRecognizer: async () => undefined,
      loadGrammarCorrector: async () => undefined,
      loadTextToSpeech: async () => {
        throw new Error('vocoder missing')
      },
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
    })

    expect(isWarmPreloadSuccessful(result)).toBe(false)
  })
})
