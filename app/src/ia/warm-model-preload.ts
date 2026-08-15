/**
 * Warm preload plan: overlap Hugging Face downloads (ASR + T5 + SpeechT5)
 * instead of waiting for Whisper before starting the others.
 */

export interface WarmModelPreloadLoaders {
  readonly loadSpeechRecognizer: () => Promise<void>
  readonly loadGrammarCorrector: () => Promise<void>
  readonly loadTextToSpeech: () => Promise<void>
}

export interface WarmModelPreloadResult {
  readonly asrReady: boolean
  readonly grammarReady: boolean
  readonly ttsReady: boolean
}

export async function runWarmModelPreload(
  loaders: WarmModelPreloadLoaders,
): Promise<WarmModelPreloadResult> {
  const [asr, grammar, tts] = await Promise.allSettled([
    loaders.loadSpeechRecognizer(),
    loaders.loadGrammarCorrector(),
    loaders.loadTextToSpeech(),
  ])
  return {
    asrReady: asr.status === 'fulfilled',
    grammarReady: grammar.status === 'fulfilled',
    ttsReady: tts.status === 'fulfilled',
  }
}

export function isWarmPreloadSuccessful(result: WarmModelPreloadResult): boolean {
  return result.asrReady
}
