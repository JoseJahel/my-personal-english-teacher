/**
 * Warm preload plan: overlap Hugging Face downloads (ASR + T5 + Supertonic)
 * instead of waiting for Whisper before starting the others.
 */

import { preloadTutorVoiceEmbeddings } from './text-to-speech-synthesis'

export interface WarmModelPreloadLoaders {
  readonly loadSpeechRecognizer: () => Promise<void>
  readonly loadGrammarCorrector: () => Promise<void>
  readonly loadTextToSpeech: () => Promise<void>
  /**
   * Downloads the pinned tutor voice reference audio so the first synthesis
   * turn does not have to fetch it uncached (see `text-to-speech-synthesis.ts`
   * for why that fetch bypasses the model-weight cache). Optional: defaults
   * to the real `preloadTutorVoiceEmbeddings` when omitted, so existing
   * callers keep working unchanged; tests can override it to avoid real
   * network/cache access.
   */
  readonly loadTutorVoiceEmbeddings?: () => Promise<void>
}

export interface WarmModelPreloadResult {
  readonly asrReady: boolean
  readonly grammarReady: boolean
  readonly ttsReady: boolean
  readonly voiceEmbeddingsReady: boolean
}

export async function runWarmModelPreload(
  loaders: WarmModelPreloadLoaders,
): Promise<WarmModelPreloadResult> {
  const loadTutorVoiceEmbeddings =
    loaders.loadTutorVoiceEmbeddings ??
    (async () => {
      await preloadTutorVoiceEmbeddings()
    })

  const [asr, grammar, tts, voice] = await Promise.allSettled([
    loaders.loadSpeechRecognizer(),
    loaders.loadGrammarCorrector(),
    loaders.loadTextToSpeech(),
    loadTutorVoiceEmbeddings(),
  ])

  if (voice.status === 'rejected') {
    // Not fatal: `synthesizeSpeechFromText` still falls back to fetching the
    // voice URL itself on first use, so the turn degrades instead of
    // breaking. It must not vanish silently, though.
    console.error(
      'Tutor voice embeddings preload failed; will fall back to fetching on first synthesis.',
      voice.reason,
    )
  }

  return {
    asrReady: asr.status === 'fulfilled',
    grammarReady: grammar.status === 'fulfilled',
    ttsReady: tts.status === 'fulfilled',
    voiceEmbeddingsReady: voice.status === 'fulfilled',
  }
}

export function isWarmPreloadSuccessful(result: WarmModelPreloadResult): boolean {
  return result.asrReady
}
