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
  | { readonly kind: 'degenerate'; readonly previewText: string }
  | { readonly kind: 'generic' }

/** Grammar-correction status (second pipeline stage, post-ASR). */
export type GrammarCorrectionUiStatus =
  | 'idle'
  | 'loading-model'
  | 'correcting-grammar'
  | 'done'
  | 'error'

/** Tutor TTS status (Supertonic; loads on first speak). */
export type SpeechSynthesisUiStatus =
  | 'idle'
  | 'loading-model'
  | 'synthesizing'
  | 'playing'
  | 'done'
  | 'error'

/** Pronunciation score status (MFCC/YIN + DTW vs TTS reference). */
export type PronunciationUiStatus =
  | 'idle'
  | 'scoring'
  | 'done'
  | 'unavailable'
  | 'not-evaluated'
  | 'deferred-to-drill'
/** Drill status: repeat the tutor's last line and get scored against it. */
export type DrillUiStatus = 'idle' | 'listening' | 'scoring' | 'done' | 'unavailable'
/** Tutor reply generation status (SmolLM2; loads on scenario selection). */
export type TutorGenerationUiStatus =
  | 'idle'
  | 'loading-model'
  | 'generating'
  | 'done-generated'
  | 'done-fallback'
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
    default:
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
    case 'degenerate':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.noAudioDegenerate(
        noAudioReason.previewText,
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
  approxAsrDownloadMb = 0,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.idle
    case 'no-audio':
      return noAudioStatusMessageFor(noAudioReason)
    case 'loading-model':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.modelLoadingProgressMessage(
        modelLoadingProgressPercent,
        approxAsrDownloadMb,
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
    default:
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

function speechSynthesisErrorMessageFor(reason: InferenceClientErrorReason | null): string {
  switch (reason) {
    case 'model-load-failed':
      return homeScreenInterfaceTexts.speechSynthesisErrorMessages.modelLoadFailed
    case 'synthesis-failed':
      return homeScreenInterfaceTexts.speechSynthesisErrorMessages.synthesisFailed
    case 'empty-text':
      return homeScreenInterfaceTexts.speechSynthesisErrorMessages.emptyText
    case 'worker-unavailable':
      return homeScreenInterfaceTexts.speechSynthesisErrorMessages.workerUnavailable
    default:
      return homeScreenInterfaceTexts.speechSynthesisErrorMessages.synthesisFailed
  }
}

export function speechSynthesisStatusMessageFor(
  status: SpeechSynthesisUiStatus,
  modelLoadingProgressPercent: number,
  speechSynthesisErrorReason: InferenceClientErrorReason | null,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.speechSynthesisStatusMessages.idle
    case 'loading-model':
      return homeScreenInterfaceTexts.speechSynthesisStatusMessages.modelLoadingProgressMessage(
        homeScreenInterfaceTexts.modelDisplayNames.textToSpeech,
        modelLoadingProgressPercent,
      )
    case 'synthesizing':
      return homeScreenInterfaceTexts.speechSynthesisStatusMessages.synthesizing
    case 'playing':
      return homeScreenInterfaceTexts.speechSynthesisStatusMessages.playing
    case 'done':
      return homeScreenInterfaceTexts.speechSynthesisStatusMessages.done
    case 'error':
      return speechSynthesisErrorMessageFor(speechSynthesisErrorReason)
  }
}

export function pronunciationStatusMessageFor(
  status: PronunciationUiStatus,
  score0to100: number | null,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.pronunciationStatusMessages.idle
    case 'scoring':
      return homeScreenInterfaceTexts.pronunciationStatusMessages.scoring
    case 'done':
      return homeScreenInterfaceTexts.pronunciationStatusMessages.done(score0to100 ?? 0)
    case 'unavailable':
      return homeScreenInterfaceTexts.pronunciationStatusMessages.unavailable
    case 'not-evaluated':
      return homeScreenInterfaceTexts.pronunciationStatusMessages.notEvaluated
    case 'deferred-to-drill':
      return homeScreenInterfaceTexts.pronunciationStatusMessages.deferredToDrill
  }
}
export function drillStatusMessageFor(
  status: DrillUiStatus,
  score0to100: number | null,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.drill.statusIdle
    case 'listening':
      return homeScreenInterfaceTexts.drill.statusListening
    case 'scoring':
      return homeScreenInterfaceTexts.drill.statusScoring
    case 'done':
      return homeScreenInterfaceTexts.drill.statusDone(score0to100 ?? 0)
    case 'unavailable':
      return homeScreenInterfaceTexts.drill.statusUnavailable
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

export function tutorGenerationStatusMessageFor(
  status: TutorGenerationUiStatus,
  modelLoadingProgressPercent: number,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.tutorGeneration.statusIdle
    case 'loading-model':
      return homeScreenInterfaceTexts.tutorGeneration.statusPreparingModel(
        modelLoadingProgressPercent,
      )
    case 'generating':
      return homeScreenInterfaceTexts.tutorGeneration.statusGenerating
    case 'done-generated':
      return homeScreenInterfaceTexts.tutorGeneration.statusDoneGenerated
    case 'done-fallback':
      return homeScreenInterfaceTexts.tutorGeneration.statusDoneFallback
    case 'error':
      return homeScreenInterfaceTexts.tutorGeneration.statusError
  }
}

/** Discreet "Preparando tutor conversacional…" strip inside the chat. */
export function shouldShowTutorModelPreparingBanner(status: TutorGenerationUiStatus): boolean {
  return status === 'loading-model'
}

/** "El tutor está escribiendo…" bubble while `generateTutorReply` runs. */
export function shouldShowTutorTypingIndicator(status: TutorGenerationUiStatus): boolean {
  return status === 'generating'
}

/** Half-duplex lock: only tutor TTS playback, not SmolLM2 thinking (issue #96). */
export function isTutorPlaybackActive(status: SpeechSynthesisUiStatus): boolean {
  return status === 'loading-model' || status === 'synthesizing' || status === 'playing'
}
