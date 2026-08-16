/**
 * Local OS voice (speechSynthesis). Used as the instant tutor path when
 * SpeechT5 PCM is not cached yet. Not Web Speech ASR — audio stays on-device.
 */

import type { PlayMonoPcmResult } from './play-pcm-mono'

function pickEnglishVoice(synthesis: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synthesis.getVoices()
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ?? null
}

/**
 * Speak English with the browser voice. Abort cancels leftover utterances.
 * cutoffMs uses wall time (no AudioContext clock).
 */
export async function playEnglishWithBrowserSpeechSynthesis(
  text: string,
  options?: {
    readonly signal?: AbortSignal
  },
): Promise<PlayMonoPcmResult> {
  const spokenText = text.replace(/\s+/g, ' ').trim()
  const synthesis = globalThis.speechSynthesis
  if (!spokenText || !synthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    return { completed: true, cutoffMs: 0 }
  }
  if (options?.signal?.aborted) {
    return { completed: false, cutoffMs: 0 }
  }

  const utterance = new SpeechSynthesisUtterance(spokenText)
  const englishVoice = pickEnglishVoice(synthesis)
  if (englishVoice) {
    utterance.voice = englishVoice
    utterance.lang = englishVoice.lang
  } else {
    utterance.lang = 'en-US'
  }

  const startedAtMs = Date.now()
  let completed = true

  return new Promise<PlayMonoPcmResult>((resolve) => {
    const finish = (): void => {
      options?.signal?.removeEventListener('abort', handleAbort)
      const cutoffMs = Math.max(0, Date.now() - startedAtMs)
      resolve({ completed, cutoffMs })
    }
    const handleAbort = (): void => {
      completed = false
      synthesis.cancel()
    }

    utterance.onend = finish
    utterance.onerror = () => {
      completed = false
      finish()
    }
    if (options?.signal) {
      options.signal.addEventListener('abort', handleAbort, { once: true })
    }
    synthesis.speak(utterance)
  })
}
