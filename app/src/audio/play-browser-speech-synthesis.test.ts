import { afterEach, describe, expect, it, vi } from 'vitest'
import { playEnglishWithBrowserSpeechSynthesis } from './play-browser-speech-synthesis'

class FakeUtterance {
  readonly text: string
  lang = ''
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

class FakeSpeechSynthesis {
  canceled = false
  lastUtterance: FakeUtterance | null = null
  failNext = false

  getVoices(): Array<{ lang: string; name: string }> {
    return [{ lang: 'en-US', name: 'Test English' }]
  }

  speak(utterance: FakeUtterance): void {
    this.lastUtterance = utterance
    queueMicrotask(() => {
      if (this.failNext) {
        utterance.onerror?.({ error: 'synthesis-failed' })
        return
      }
      utterance.onend?.()
    })
  }

  cancel(): void {
    this.canceled = true
    this.lastUtterance?.onend?.()
  }
}

describe('playEnglishWithBrowserSpeechSynthesis', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('plays English text through the local speechSynthesis voice', async () => {
    const synthesis = new FakeSpeechSynthesis()
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    vi.stubGlobal('speechSynthesis', synthesis)

    const result = await playEnglishWithBrowserSpeechSynthesis('Hello there.')

    expect(synthesis.lastUtterance?.text).toBe('Hello there.')
    expect(synthesis.lastUtterance?.lang.startsWith('en')).toBe(true)
    expect(result.completed).toBe(true)
    expect(result.cutoffMs).toBeGreaterThanOrEqual(0)
  })

  it('stops on abort and reports an incomplete cutoff', async () => {
    const synthesis = new FakeSpeechSynthesis()
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    vi.stubGlobal('speechSynthesis', synthesis)
    const abortController = new AbortController()

    const pending = playEnglishWithBrowserSpeechSynthesis('Please wait.', {
      signal: abortController.signal,
    })
    abortController.abort()
    const result = await pending

    expect(synthesis.canceled).toBe(true)
    expect(result.completed).toBe(false)
  })

  it('returns a completed empty result when speechSynthesis is missing', async () => {
    vi.stubGlobal('speechSynthesis', undefined)
    const result = await playEnglishWithBrowserSpeechSynthesis('Hello.')
    expect(result).toEqual({ completed: true, cutoffMs: 0 })
  })
})
