/**
 * Local OS voice (speechSynthesis). Used as the instant tutor path when
 * neural TTS PCM is not cached yet. Not Web Speech ASR — audio stays on-device.
 */

import type { PlayMonoPcmResult } from './play-pcm-mono'

export interface SpeechVoiceLike {
  readonly lang: string
  readonly name: string
}

const VOICE_WAIT_TIMEOUT_MS = 300

// Weights for scoreEnglishVoice. Values are relative, not calibrated
// against any external metric, so only their ordering matters: region
// match beats a merely-English voice, and quality/vendor cues beat a
// plain region match, while the mislabeled-Spanish penalty must outweigh
// every bonus above so a mistagged voice always loses to a real one.
const BASE_ENGLISH_LANG_SCORE = 1
const US_REGION_BONUS = 3
const UK_REGION_BONUS = 2
const QUALITY_OR_VENDOR_NAME_BONUS = 4
const MISLABELED_SPANISH_VOICE_PENALTY = 10

// Vendor/quality markers that reliably indicate a higher-fidelity engine
// voice across platforms. Proper voice names (e.g. "Samantha", "Aria")
// were dropped from this list: they are brand-specific labels with no
// test coverage demonstrating they change the pick, unlike the terms
// below.
const QUALITY_OR_VENDOR_NAME_PATTERN = /(neural|natural|online|premium|enhanced|google|microsoft)/

// Some voice lists mislabel legacy voices: the browser/OS can report
// `lang: 'en-US'` for a voice whose `name` reveals it is actually a
// Spanish voice (e.g. a Windows SAPI voice like "Microsoft Helena
// Desktop - Spanish"). `lang` and `name` are independent fields on the
// same object, so this branch is reachable even after the `en*` lang
// filter above. The penalty stops us from narrating English lines with a
// mistagged Spanish-accented voice.
const MISLABELED_SPANISH_VOICE_NAME_PATTERN = /(spanish|español|helena|sabina|pablo)/

export function scoreEnglishVoice(voice: SpeechVoiceLike): number {
  const lang = voice.lang.toLowerCase()
  const name = voice.name.toLowerCase()
  if (!lang.startsWith('en')) {
    return Number.NEGATIVE_INFINITY
  }
  let score = BASE_ENGLISH_LANG_SCORE
  if (lang.startsWith('en-us')) {
    score += US_REGION_BONUS
  } else if (lang.startsWith('en-gb') || lang.startsWith('en-uk')) {
    score += UK_REGION_BONUS
  }
  if (QUALITY_OR_VENDOR_NAME_PATTERN.test(name)) {
    score += QUALITY_OR_VENDOR_NAME_BONUS
  }
  if (MISLABELED_SPANISH_VOICE_NAME_PATTERN.test(name)) {
    score -= MISLABELED_SPANISH_VOICE_PENALTY
  }
  return score
}

export function pickPreferredEnglishVoice<T extends SpeechVoiceLike>(
  voices: readonly T[],
): T | null {
  let best: T | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const voice of voices) {
    const score = scoreEnglishVoice(voice)
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return bestScore > Number.NEGATIVE_INFINITY ? best : null
}

async function listSpeechVoices(synthesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const existing = synthesis.getVoices()
  if (existing.length > 0) {
    return existing
  }
  await new Promise<void>((resolve) => {
    const finish = () => resolve()
    if (typeof synthesis.addEventListener === 'function') {
      synthesis.addEventListener('voiceschanged', finish, { once: true })
    }
    setTimeout(finish, VOICE_WAIT_TIMEOUT_MS)
  })
  return synthesis.getVoices()
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

  let aborted = Boolean(options?.signal?.aborted)
  let completed = true
  const handleAbort = (): void => {
    aborted = true
    completed = false
    synthesis.cancel()
  }
  if (options?.signal) {
    options.signal.addEventListener('abort', handleAbort, { once: true })
  }
  if (aborted) {
    options?.signal?.removeEventListener('abort', handleAbort)
    return { completed: false, cutoffMs: 0 }
  }

  const voices = await listSpeechVoices(synthesis)
  if (aborted) {
    options?.signal?.removeEventListener('abort', handleAbort)
    return { completed: false, cutoffMs: 0 }
  }

  const utterance = new SpeechSynthesisUtterance(spokenText)
  const englishVoice = pickPreferredEnglishVoice(voices)
  if (englishVoice) {
    utterance.voice = englishVoice
    utterance.lang = englishVoice.lang
  } else {
    utterance.lang = 'en-US'
  }

  const startedAtMs = Date.now()

  return new Promise<PlayMonoPcmResult>((resolve) => {
    const finish = (): void => {
      options?.signal?.removeEventListener('abort', handleAbort)
      const cutoffMs = Math.max(0, Date.now() - startedAtMs)
      resolve({ completed, cutoffMs })
    }

    utterance.onend = finish
    utterance.onerror = () => {
      completed = false
      finish()
    }
    if (aborted) {
      completed = false
      finish()
      return
    }
    synthesis.speak(utterance)
  })
}
