/**
 * Energy-based voice activity detection (pure domain).
 * Used for live auto-stop after end-of-utterance silence (Avance 2).
 */

import {
  MINIMUM_CAPTURE_ENERGY_RMS,
  MINIMUM_CAPTURE_PEAK,
} from './signal-energy'

/** Require this much continuous speech before trailing silence can stop. */
export const DEFAULT_VAD_MINIMUM_SPEECH_MS = 380

/** Silence after speech that triggers auto-stop. */
export const DEFAULT_VAD_SILENCE_HANGOVER_MS = 1100

/** Hard cap so a stuck session always ends. */
export const DEFAULT_VAD_MAXIMUM_UTTERANCE_MS = 15_000

/**
 * Live thresholds below post-capture gate so quieter speech still starts VAD.
 * Hangover is a bit longer so users do not get cut mid-phrase.
 */
export const DEFAULT_VAD_SPEECH_RMS = MINIMUM_CAPTURE_ENERGY_RMS * 0.7
export const DEFAULT_VAD_SPEECH_PEAK = MINIMUM_CAPTURE_PEAK * 0.7

export type VoiceActivityState =
  | 'waiting-for-speech'
  | 'in-speech'
  | 'trailing-silence'

export interface VoiceActivityFrameMeters {
  readonly rms: number
  readonly peak: number
}

export interface VoiceActivityDetectorOptions {
  readonly speechRmsThreshold?: number
  readonly speechPeakThreshold?: number
  readonly minimumSpeechMs?: number
  readonly silenceHangoverMs?: number
  readonly maximumUtteranceMs?: number
}

export interface VoiceActivityPushResult {
  readonly state: VoiceActivityState
  /** True once: caller should stop capture and run the pipeline. */
  readonly shouldAutoStop: boolean
  readonly hasHeardSpeech: boolean
  readonly speechDurationMs: number
  readonly silenceDurationMs: number
}

/**
 * Stateful energy VAD. Push analyser meters on each animation frame (~16 ms).
 * Pure: no timers, no browser APIs — the caller supplies `nowMs`.
 */
export function createEnergyVoiceActivityDetector(
  options?: VoiceActivityDetectorOptions,
): {
  pushFrame: (meters: VoiceActivityFrameMeters, nowMs: number) => VoiceActivityPushResult
  reset: () => void
  getState: () => VoiceActivityState
} {
  const speechRmsThreshold = options?.speechRmsThreshold ?? DEFAULT_VAD_SPEECH_RMS
  const speechPeakThreshold = options?.speechPeakThreshold ?? DEFAULT_VAD_SPEECH_PEAK
  const minimumSpeechMs = options?.minimumSpeechMs ?? DEFAULT_VAD_MINIMUM_SPEECH_MS
  const silenceHangoverMs = options?.silenceHangoverMs ?? DEFAULT_VAD_SILENCE_HANGOVER_MS
  const maximumUtteranceMs = options?.maximumUtteranceMs ?? DEFAULT_VAD_MAXIMUM_UTTERANCE_MS

  let state: VoiceActivityState = 'waiting-for-speech'
  let hasHeardSpeech = false
  let speechSegmentStartedAtMs: number | null = null
  let accumulatedSpeechMs = 0
  let silenceStartedAtMs: number | null = null
  let sessionStartedAtMs: number | null = null
  let autoStopEmitted = false

  function isSpeechFrame(meters: VoiceActivityFrameMeters): boolean {
    return meters.rms >= speechRmsThreshold || meters.peak >= speechPeakThreshold
  }

  function speechDurationMs(nowMs: number): number {
    const openSegmentMs =
      speechSegmentStartedAtMs === null ? 0 : Math.max(0, nowMs - speechSegmentStartedAtMs)
    return accumulatedSpeechMs + openSegmentMs
  }

  function silenceDurationMs(nowMs: number): number {
    if (silenceStartedAtMs === null) {
      return 0
    }
    return Math.max(0, nowMs - silenceStartedAtMs)
  }

  function pushFrame(
    meters: VoiceActivityFrameMeters,
    nowMs: number,
  ): VoiceActivityPushResult {
    if (sessionStartedAtMs === null) {
      sessionStartedAtMs = nowMs
    }

    const speaking = isSpeechFrame(meters)

    if (speaking) {
      if (!hasHeardSpeech) {
        hasHeardSpeech = true
      }
      if (speechSegmentStartedAtMs === null) {
        speechSegmentStartedAtMs = nowMs
      }
      state = 'in-speech'
      silenceStartedAtMs = null
    } else if (hasHeardSpeech) {
      if (speechSegmentStartedAtMs !== null) {
        accumulatedSpeechMs += Math.max(0, nowMs - speechSegmentStartedAtMs)
        speechSegmentStartedAtMs = null
      }
      if (silenceStartedAtMs === null) {
        silenceStartedAtMs = nowMs
      }
      state = 'trailing-silence'
    } else {
      state = 'waiting-for-speech'
    }

    const speechMs = speechDurationMs(nowMs)
    const silenceMs = silenceDurationMs(nowMs)
    const sessionMs = nowMs - (sessionStartedAtMs ?? nowMs)

    let shouldAutoStop = false
    if (!autoStopEmitted) {
      const endOfPhrase =
        hasHeardSpeech &&
        speechMs >= minimumSpeechMs &&
        silenceMs >= silenceHangoverMs
      const maxDuration = sessionMs >= maximumUtteranceMs
      if (endOfPhrase || maxDuration) {
        shouldAutoStop = true
        autoStopEmitted = true
      }
    }

    return {
      state,
      shouldAutoStop,
      hasHeardSpeech,
      speechDurationMs: speechMs,
      silenceDurationMs: silenceMs,
    }
  }

  function reset(): void {
    state = 'waiting-for-speech'
    hasHeardSpeech = false
    speechSegmentStartedAtMs = null
    accumulatedSpeechMs = 0
    silenceStartedAtMs = null
    sessionStartedAtMs = null
    autoStopEmitted = false
  }

  return {
    pushFrame,
    reset,
    getState: () => state,
  }
}
