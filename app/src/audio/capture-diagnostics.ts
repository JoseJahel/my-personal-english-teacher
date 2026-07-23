/**
 * Capture diagnostics returned after stop() for UI troubleshooting.
 */

import { computePeakAmplitude, computeRootMeanSquareEnergy } from '../dsp/signal-energy'

export type CaptureAudioSource = 'media-recorder' | 'none'

export interface CaptureDiagnostics {
  readonly sampleCount: number
  readonly durationSeconds: number
  readonly rmsEnergy: number
  readonly peakAmplitude: number
  readonly deviceLabel: string
  readonly source: CaptureAudioSource
  readonly mediaRecorderBlobBytes: number
  readonly trackReadyState: string
  readonly trackMuted: boolean
  readonly audioContextState: string
}

export function buildCaptureDiagnostics(params: {
  readonly samples: Float32Array
  readonly sampleRate: number
  readonly deviceLabel: string
  readonly source: CaptureAudioSource
  readonly mediaRecorderBlobBytes: number
  readonly trackReadyState: string
  readonly trackMuted: boolean
  readonly audioContextState: string
}): CaptureDiagnostics {
  const safeRate = params.sampleRate > 0 ? params.sampleRate : 1
  return {
    sampleCount: params.samples.length,
    durationSeconds: params.samples.length / safeRate,
    rmsEnergy: computeRootMeanSquareEnergy(params.samples),
    peakAmplitude: computePeakAmplitude(params.samples),
    deviceLabel: params.deviceLabel,
    source: params.source,
    mediaRecorderBlobBytes: params.mediaRecorderBlobBytes,
    trackReadyState: params.trackReadyState,
    trackMuted: params.trackMuted,
    audioContextState: params.audioContextState,
  }
}
