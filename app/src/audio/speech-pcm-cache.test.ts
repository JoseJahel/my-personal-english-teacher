import { afterEach, describe, expect, it } from 'vitest'
import {
  clearSpeechPcmCache,
  getCachedSpeechPcm,
  normalizeSpeechCacheKey,
  setCachedSpeechPcm,
} from './speech-pcm-cache'

describe('speech-pcm-cache', () => {
  afterEach(() => {
    clearSpeechPcmCache()
  })

  it('normalizes whitespace and case so scripted lines hit the cache', () => {
    expect(normalizeSpeechCacheKey('  Hello,  there. ')).toBe('hello, there.')
  })

  it('returns null on a miss and the same samples on a hit', () => {
    const samples = new Float32Array([0.1, -0.2, 0.3])
    expect(getCachedSpeechPcm('Welcome! I am your waiter.')).toBeNull()

    setCachedSpeechPcm('Welcome! I am your waiter.', {
      samples,
      sampleRateInHertz: 16_000,
    })

    const hit = getCachedSpeechPcm(' welcome!  I am your waiter. ')
    expect(hit).not.toBeNull()
    expect(hit?.sampleRateInHertz).toBe(16_000)
    expect(hit?.samples).toBe(samples)
  })

  it('does not store empty text', () => {
    setCachedSpeechPcm('   ', {
      samples: new Float32Array([1]),
      sampleRateInHertz: 16_000,
    })
    expect(getCachedSpeechPcm('   ')).toBeNull()
  })
})
