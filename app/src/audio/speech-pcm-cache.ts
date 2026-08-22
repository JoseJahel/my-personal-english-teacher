/**
 * Session-scoped PCM cache for tutor lines already synthesized with neural TTS.
 * Keys are normalized so curated script variants hit the same entry.
 */

export interface CachedSpeechPcm {
  readonly samples: Float32Array
  readonly sampleRateInHertz: number
}

const cachedSpeechByNormalizedText = new Map<string, CachedSpeechPcm>()

export function normalizeSpeechCacheKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function getCachedSpeechPcm(text: string): CachedSpeechPcm | null {
  const key = normalizeSpeechCacheKey(text)
  if (!key) {
    return null
  }
  return cachedSpeechByNormalizedText.get(key) ?? null
}

export function setCachedSpeechPcm(text: string, audio: CachedSpeechPcm): void {
  const key = normalizeSpeechCacheKey(text)
  if (!key || audio.samples.length === 0 || audio.sampleRateInHertz <= 0) {
    return
  }
  cachedSpeechByNormalizedText.set(key, audio)
}

export function clearSpeechPcmCache(): void {
  cachedSpeechByNormalizedText.clear()
}
