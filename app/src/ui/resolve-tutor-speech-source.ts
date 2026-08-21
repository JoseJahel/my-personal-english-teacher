import { getCachedSpeechPcm } from '../audio/speech-pcm-cache'

export type TutorSpeechSource =
  | { readonly kind: 'cached-pcm'; readonly samples: Float32Array; readonly sampleRateInHertz: number }
  | { readonly kind: 'browser-speech'; readonly text: string }

/**
 * Instant tutor voice: cached neural TTS PCM if present, otherwise the local
 * OS English voice. Do not synthesize on this worker here — TTS would block
 * the next Whisper job.
 */
export async function resolveTutorSpeechSource(
  englishText: string,
): Promise<TutorSpeechSource> {
  const text = englishText.replace(/\s+/g, ' ').trim()
  const cached = getCachedSpeechPcm(text)
  if (cached) {
    return {
      kind: 'cached-pcm',
      samples: cached.samples,
      sampleRateInHertz: cached.sampleRateInHertz,
    }
  }

  return { kind: 'browser-speech', text }
}
