import { afterEach, describe, expect, it } from 'vitest'
import { clearSpeechPcmCache, setCachedSpeechPcm } from '../audio/speech-pcm-cache'
import { resolveTutorSpeechSource } from './resolve-tutor-speech-source'

describe('resolveTutorSpeechSource', () => {
  afterEach(() => {
    clearSpeechPcmCache()
  })

  it('plays cached SpeechT5 PCM without synthesizing again', async () => {
    const samples = new Float32Array([0.5, 0.25])
    setCachedSpeechPcm('Hello from the cache.', { samples, sampleRateInHertz: 16_000 })
    const source = await resolveTutorSpeechSource('Hello from the cache.')

    expect(source.kind).toBe('cached-pcm')
    if (source.kind !== 'cached-pcm') {
      throw new Error('expected cached PCM')
    }
    expect(source.samples).toBe(samples)
  })

  it('uses the local browser voice on a cache miss so the worker stays free for Whisper', async () => {
    const source = await resolveTutorSpeechSource('A new waiter line.')

    expect(source).toEqual({ kind: 'browser-speech', text: 'A new waiter line.' })
  })
})
