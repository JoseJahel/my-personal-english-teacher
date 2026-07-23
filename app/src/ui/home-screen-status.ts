/**
 * UI status types and status-message mappers for the home screen.
 * Visible copy always comes from `interface-texts.ts`.
 */

import type { InferenceClientErrorReason } from '../ia/inference-client'
import type { CaptureDiagnostics } from '../audio/microphone-capture'
import { homeScreenInterfaceTexts } from './interface-texts'

/** Microphone capture status from the UI's point of view. */
export type MicrophoneUiStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'stopped'
  | 'permission-denied'
  | 'error'

/**
 * ASR status independent of the mic: transcription may still run in the
 * worker after capture has already stopped.
 */
export type TranscriptionUiStatus =
  | 'idle'
  | 'no-audio'
  | 'loading-model'
  | 'transcribing'
  | 'done'
  | 'error'

/** Why no usable speech was obtained (for a precise no-audio message). */
export type NoAudioReason =
  | { readonly kind: 'empty-recording' }
  | { readonly kind: 'low-energy'; readonly diagnostics: CaptureDiagnostics }
  | { readonly kind: 'non-speech'; readonly whisperRawText: string }
  | { readonly kind: 'generic' }

/** Grammar-correction status (second pipeline stage, post-ASR). */
export type GrammarCorrectionUiStatus =
  | 'idle'
  | 'loading-model'
  | 'correcting-grammar'
  | 'done'
  | 'error'

export function microphoneStatusMessageFor(
  status: MicrophoneUiStatus,
  errorDetail: string | null = null,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.microphoneStatusMessages.idle
    case 'starting':
      return homeScreenInterfaceTexts.microphoneStatusMessages.starting
    case 'listening':
      return homeScreenInterfaceTexts.microphoneStatusMessages.listening
    case 'stopped':
      return homeScreenInterfaceTexts.microphoneStatusMessages.stopped
    case 'permission-denied':
      return homeScreenInterfaceTexts.microphoneStatusMessages.permissionDenied
    case 'error':
      if (errorDetail && errorDetail.trim().length > 0) {
        return homeScreenInterfaceTexts.microphoneStatusMessages.detailedError(errorDetail)
      }
      return homeScreenInterfaceTexts.microphoneStatusMessages.genericError
  }
}

function transcriptionErrorMessageFor(reason: InferenceClientErrorReason | null): string {
  switch (reason) {
    case 'invalid-sample-rate':
      return homeScreenInterfaceTexts.transcriptionErrorMessages.invalidSampleRate
    case 'model-load-failed':
      return homeScreenInterfaceTexts.transcriptionErrorMessages.modelLoadFailed
    case 'transcription-failed':
      return homeScreenInterfaceTexts.transcriptionErrorMessages.transcriptionFailed
    case 'worker-unavailable':
      return homeScreenInterfaceTexts.transcriptionErrorMessages.workerUnavailable
    case 'correction-failed':
    case null:
      return homeScreenInterfaceTexts.transcriptionErrorMessages.transcriptionFailed
  }
}

function noAudioStatusMessageFor(noAudioReason: NoAudioReason | null): string {
  if (!noAudioReason) {
    return homeScreenInterfaceTexts.transcriptionStatusMessages.noAudioCaptured
  }
  switch (noAudioReason.kind) {
    case 'empty-recording':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.noAudioEmptyRecording
    case 'low-energy':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.noAudioLowEnergy(
        noAudioReason.diagnostics.rmsEnergy,
        noAudioReason.diagnostics.peakAmplitude,
        noAudioReason.diagnostics.deviceLabel,
      )
    case 'non-speech':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.noAudioNonSpeech(
        noAudioReason.whisperRawText,
      )
    case 'generic':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.noAudioCaptured
  }
}

export function transcriptionStatusMessageFor(
  status: TranscriptionUiStatus,
  modelLoadingProgressPercent: number,
  transcriptionErrorReason: InferenceClientErrorReason | null,
  noAudioReason: NoAudioReason | null = null,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.idle
    case 'no-audio':
      return noAudioStatusMessageFor(noAudioReason)
    case 'loading-model':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.modelLoadingProgressMessage(
        modelLoadingProgressPercent,
      )
    case 'transcribing':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.transcribing
    case 'done':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.done
    case 'error':
      return transcriptionErrorMessageFor(transcriptionErrorReason)
  }
}

function grammarCorrectionErrorMessageFor(reason: InferenceClientErrorReason | null): string {
  switch (reason) {
    case 'model-load-failed':
      return homeScreenInterfaceTexts.grammarCorrectionErrorMessages.modelLoadFailed
    case 'correction-failed':
      return homeScreenInterfaceTexts.grammarCorrectionErrorMessages.correctionFailed
    case 'worker-unavailable':
      return homeScreenInterfaceTexts.grammarCorrectionErrorMessages.workerUnavailable
    case 'invalid-sample-rate':
    case 'transcription-failed':
    case null:
      return homeScreenInterfaceTexts.grammarCorrectionErrorMessages.correctionFailed
  }
}

export function grammarCorrectionStatusMessageFor(
  status: GrammarCorrectionUiStatus,
  modelLoadingProgressPercent: number,
  grammarCorrectionErrorReason: InferenceClientErrorReason | null,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.grammarCorrectionStatusMessages.idle
    case 'loading-model':
      return homeScreenInterfaceTexts.grammarCorrectionStatusMessages.modelLoadingProgressMessage(
        homeScreenInterfaceTexts.modelDisplayNames.grammarCorrection,
        modelLoadingProgressPercent,
      )
    case 'correcting-grammar':
      return homeScreenInterfaceTexts.grammarCorrectionStatusMessages.correcting
    case 'done':
      return homeScreenInterfaceTexts.grammarCorrectionStatusMessages.done
    case 'error':
      return grammarCorrectionErrorMessageFor(grammarCorrectionErrorReason)
  }
}

export function captureDiagnosticsMessageFor(diagnostics: CaptureDiagnostics): string {
  return homeScreenInterfaceTexts.captureDiagnosticsMessage({
    sampleCount: diagnostics.sampleCount,
    durationSeconds: diagnostics.durationSeconds,
    rmsEnergy: diagnostics.rmsEnergy,
    peakAmplitude: diagnostics.peakAmplitude,
    deviceLabel: diagnostics.deviceLabel,
    source: diagnostics.source,
    mediaRecorderBlobBytes: diagnostics.mediaRecorderBlobBytes,
    trackReadyState: diagnostics.trackReadyState,
    trackMuted: diagnostics.trackMuted,
    audioContextState: diagnostics.audioContextState,
  })
}
