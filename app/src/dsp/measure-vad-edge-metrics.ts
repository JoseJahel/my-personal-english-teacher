/**
 * Labeled VAD edge metrics (issue #74).
 * Feeds hop RMS/peak from synthetic PCM into the same energy VAD the UI uses.
 */

import {
  computePeakAmplitude,
  computeRootMeanSquareEnergy,
} from './signal-energy'
import {
  DEFAULT_VAD_SILENCE_HANGOVER_MS,
  createEnergyVoiceActivityDetector,
  type VoiceActivityDetectorOptions,
} from './voice-activity-detection'

/** Matches a typical animation-frame cadence in the live session. */
export const VAD_EDGE_HOP_MS = 16
/** Acceptance: start/end error within one hop on a hard-gated tone. */
export const VAD_EDGE_MAX_ABS_START_ERROR_MS = 20
export const VAD_EDGE_MAX_ABS_END_ERROR_MS = 20
export const VAD_EDGE_MAX_ABS_HANGOVER_ERROR_MS = 20
/** Measured on the hop-aligned silence–tone–silence fixture (issue #74). */
export const VAD_EDGE_MEASURED_START_ERROR_MS = 0
export const VAD_EDGE_MEASURED_END_ERROR_MS = 0
export const VAD_EDGE_MEASURED_HANGOVER_ERROR_MS = 4

export interface SilenceToneSilenceSpec {
  readonly sampleRateInHertz: number
  readonly leadingSilenceMs: number
  readonly speechMs: number
  readonly trailingSilenceMs: number
  readonly frequencyInHertz: number
  readonly amplitude: number
}

export interface LabeledSilenceToneSilence {
  readonly samples: Float32Array
  readonly sampleRateInHertz: number
  readonly speechStartMs: number
  readonly speechEndMs: number
  readonly trailingSilenceMs: number
}

export interface VadEdgeMetrics {
  readonly hopMs: number
  readonly detectedSpeechStartMs: number | null
  readonly detectedSpeechEndMs: number | null
  readonly autoStopMs: number | null
  readonly startErrorMs: number | null
  readonly endErrorMs: number | null
  readonly autoStopErrorVsHangoverMs: number | null
  readonly trailingSilenceNotCapturedMs: number
  readonly shareOfPostSpeechSilenceDropped: number
  readonly framesPushed: number
}

export function createSilenceToneSilencePcm(
  spec: SilenceToneSilenceSpec,
): LabeledSilenceToneSilence {
  const speechStartMs = spec.leadingSilenceMs
  const speechEndMs = spec.leadingSilenceMs + spec.speechMs
  const totalMs = speechEndMs + spec.trailingSilenceMs
  const sampleCount = Math.round((totalMs / 1000) * spec.sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  const speechStartSample = Math.round((speechStartMs / 1000) * spec.sampleRateInHertz)
  const speechEndSample = Math.round((speechEndMs / 1000) * spec.sampleRateInHertz)
  for (let index = speechStartSample; index < speechEndSample && index < sampleCount; index += 1) {
    const time = index / spec.sampleRateInHertz
    samples[index] = spec.amplitude * Math.sin(2 * Math.PI * spec.frequencyInHertz * time)
  }
  return {
    samples,
    sampleRateInHertz: spec.sampleRateInHertz,
    speechStartMs,
    speechEndMs,
    trailingSilenceMs: spec.trailingSilenceMs,
  }
}

export function measureEnergyVadEdgeMetrics(
  labeled: LabeledSilenceToneSilence,
  options?: {
    readonly hopMs?: number
    readonly hangoverMs?: number
    readonly vad?: VoiceActivityDetectorOptions
  },
): VadEdgeMetrics {
  const hopMs = options?.hopMs ?? VAD_EDGE_HOP_MS
  const hangoverMs = options?.hangoverMs ?? DEFAULT_VAD_SILENCE_HANGOVER_MS
  const hopSamples = Math.max(
    1,
    Math.round((hopMs / 1000) * labeled.sampleRateInHertz),
  )
  const vad = createEnergyVoiceActivityDetector({
    silenceHangoverMs: hangoverMs,
    ...options?.vad,
  })

  let detectedSpeechStartMs: number | null = null
  let detectedSpeechEndMs: number | null = null
  let autoStopMs: number | null = null
  let framesPushed = 0

  for (let start = 0; start + hopSamples <= labeled.samples.length; start += hopSamples) {
    const nowMs = (start / labeled.sampleRateInHertz) * 1000
    const frame = labeled.samples.subarray(start, start + hopSamples)
    const result = vad.pushFrame(
      {
        rms: computeRootMeanSquareEnergy(frame),
        peak: computePeakAmplitude(frame),
      },
      nowMs,
    )
    framesPushed += 1
    if (detectedSpeechStartMs === null && result.state === 'in-speech') {
      detectedSpeechStartMs = nowMs
    }
    if (
      detectedSpeechEndMs === null &&
      detectedSpeechStartMs !== null &&
      result.state === 'trailing-silence'
    ) {
      detectedSpeechEndMs = nowMs
    }
    if (result.shouldAutoStop) {
      autoStopMs = nowMs
      break
    }
  }

  const startErrorMs =
    detectedSpeechStartMs === null ? null : detectedSpeechStartMs - labeled.speechStartMs
  const endErrorMs =
    detectedSpeechEndMs === null ? null : detectedSpeechEndMs - labeled.speechEndMs
  const expectedAutoStopMs = labeled.speechEndMs + hangoverMs
  const autoStopErrorVsHangoverMs =
    autoStopMs === null ? null : autoStopMs - expectedAutoStopMs
  const trailingSilenceNotCapturedMs = Math.max(
    0,
    labeled.trailingSilenceMs - hangoverMs - (autoStopErrorVsHangoverMs ?? 0),
  )
  const shareOfPostSpeechSilenceDropped =
    labeled.trailingSilenceMs <= 0
      ? 0
      : trailingSilenceNotCapturedMs / labeled.trailingSilenceMs

  return {
    hopMs,
    detectedSpeechStartMs,
    detectedSpeechEndMs,
    autoStopMs,
    startErrorMs,
    endErrorMs,
    autoStopErrorVsHangoverMs,
    trailingSilenceNotCapturedMs,
    shareOfPostSpeechSilenceDropped,
    framesPushed,
  }
}
