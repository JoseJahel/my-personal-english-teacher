/**
 * Derives HomeScreen status strings and flags from session UI state (pure).
 */

import { asrModelCandidates, resolveActiveAsrCandidateId } from '../ia/model-registry'
import { grammarCorrectionMadeNoChanges } from '../ia/grammar-correction'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import type { FormantTriple } from '../dsp/formant-estimation'
import type { CaptureDiagnostics } from '../audio/microphone-capture'
import type { InferenceClientErrorReason } from '../ia/inference-client'
import { homeScreenInterfaceTexts } from './interface-texts'
import {
  captureDiagnosticsMessageFor,
  grammarCorrectionStatusMessageFor,
  microphoneStatusMessageFor,
  pronunciationStatusMessageFor,
  shouldShowTutorModelPreparingBanner,
  shouldShowTutorTypingIndicator,
  speechSynthesisStatusMessageFor,
  transcriptionStatusMessageFor,
  tutorGenerationStatusMessageFor,
} from './home-screen-status'
import type {
  GrammarCorrectionUiStatus,
  MicrophoneUiStatus,
  NoAudioReason,
  PronunciationUiStatus,
  SpeechSynthesisUiStatus,
  TranscriptionUiStatus,
  TutorGenerationUiStatus,
} from './home-screen-status'
import {
  formatFormantsSummaryMessage,
  resolvePrimaryActivityMessage,
} from './home-session-helpers'

export interface HomeScreenViewModelInput {
  readonly microphoneStatus: MicrophoneUiStatus
  readonly microphoneErrorDetail: string | null
  readonly transcriptionStatus: TranscriptionUiStatus
  readonly modelLoadingProgressPercent: number
  readonly transcriptionErrorReason: InferenceClientErrorReason | null
  readonly noAudioReason: NoAudioReason | null
  readonly grammarCorrectionStatus: GrammarCorrectionUiStatus
  readonly grammarModelLoadingProgressPercent: number
  readonly grammarCorrectionErrorReason: InferenceClientErrorReason | null
  readonly speechSynthesisStatus: SpeechSynthesisUiStatus
  readonly speechModelLoadingProgressPercent: number
  readonly speechSynthesisErrorReason: InferenceClientErrorReason | null
  readonly tutorGenerationStatus: TutorGenerationUiStatus
  readonly tutorModelLoadingProgressPercent: number
  readonly pronunciationStatus: PronunciationUiStatus
  readonly pronunciationScore: PronunciationScoreResult | null
  readonly transcribedText: string
  readonly correctedGrammarText: string
  readonly captureDiagnostics: CaptureDiagnostics | null
  readonly medianFormants: FormantTriple | null
  readonly isStarting: boolean
  readonly isListening: boolean
}

export interface HomeScreenViewModel {
  readonly microphoneStatusMessage: string
  readonly transcriptionStatusMessage: string
  readonly grammarCorrectionStatusMessage: string
  readonly speechSynthesisStatusMessage: string
  readonly tutorGenerationStatusMessage: string
  readonly pronunciationStatusMessage: string
  readonly pronunciationDetailMessage: string | null
  readonly grammarCorrectionMadeNoChangesToTranscription: boolean
  readonly captureDiagnosticsMessage: string | null
  readonly isTutorSpeaking: boolean
  readonly isTutorPreparingConversationModel: boolean
  readonly isTutorComposingReply: boolean
  readonly formantsSummaryMessage: string | null
  readonly isPreparingModels: boolean
  readonly primaryActivityMessage: string
}

export function buildHomeScreenViewModel(input: HomeScreenViewModelInput): HomeScreenViewModel {
  const microphoneStatusMessage = microphoneStatusMessageFor(
    input.microphoneStatus,
    input.microphoneErrorDetail,
  )
  const transcriptionStatusMessage = transcriptionStatusMessageFor(
    input.transcriptionStatus,
    input.modelLoadingProgressPercent,
    input.transcriptionErrorReason,
    input.noAudioReason,
    asrModelCandidates[resolveActiveAsrCandidateId()].approxDownloadMb,
  )
  const grammarCorrectionStatusMessage = grammarCorrectionStatusMessageFor(
    input.grammarCorrectionStatus,
    input.grammarModelLoadingProgressPercent,
    input.grammarCorrectionErrorReason,
  )
  const speechSynthesisStatusMessage = speechSynthesisStatusMessageFor(
    input.speechSynthesisStatus,
    input.speechModelLoadingProgressPercent,
    input.speechSynthesisErrorReason,
  )
  const tutorGenerationStatusMessage = tutorGenerationStatusMessageFor(
    input.tutorGenerationStatus,
    input.tutorModelLoadingProgressPercent,
  )
  const pronunciationStatusMessage = pronunciationStatusMessageFor(
    input.pronunciationStatus,
    input.pronunciationScore?.score0to100 ?? null,
  )
  const pronunciationDetailMessage =
    input.pronunciationStatus === 'done' && input.pronunciationScore
      ? homeScreenInterfaceTexts.pronunciationStatusMessages.detail({
          mfccScore: input.pronunciationScore.mfccScore0to100,
          pitchScore: input.pronunciationScore.pitchScore0to100,
          userFrames: input.pronunciationScore.userMfccFrameCount,
          referenceFrames: input.pronunciationScore.referenceMfccFrameCount,
        })
      : null
  const grammarCorrectionMadeNoChangesToTranscription =
    input.grammarCorrectionStatus === 'done' &&
    grammarCorrectionMadeNoChanges(input.transcribedText, input.correctedGrammarText)

  const captureDiagnosticsMessage =
    input.captureDiagnostics && input.transcriptionStatus === 'no-audio'
      ? captureDiagnosticsMessageFor(input.captureDiagnostics)
      : null

  const isTutorSpeaking =
    input.tutorGenerationStatus === 'loading-model' ||
    input.tutorGenerationStatus === 'generating' ||
    input.speechSynthesisStatus === 'loading-model' ||
    input.speechSynthesisStatus === 'synthesizing' ||
    input.speechSynthesisStatus === 'playing'

  const isTutorPreparingConversationModel = shouldShowTutorModelPreparingBanner(
    input.tutorGenerationStatus,
  )
  const isTutorComposingReply = shouldShowTutorTypingIndicator(input.tutorGenerationStatus)
  const formantsSummaryMessage = formatFormantsSummaryMessage(input.medianFormants)
  const isPreparingModels =
    input.transcriptionStatus === 'loading-model' ||
    input.grammarCorrectionStatus === 'loading-model'

  const primaryActivityMessage = resolvePrimaryActivityMessage({
    isTutorSpeaking,
    isStarting: input.isStarting,
    isListening: input.isListening,
    isPreparingModels,
    microphoneStatusMessage,
    tutorGenerationStatus: input.tutorGenerationStatus,
    pronunciationStatus: input.pronunciationStatus,
    speechSynthesisStatus: input.speechSynthesisStatus,
    transcriptionStatus: input.transcriptionStatus,
  })

  return {
    microphoneStatusMessage,
    transcriptionStatusMessage,
    grammarCorrectionStatusMessage,
    speechSynthesisStatusMessage,
    tutorGenerationStatusMessage,
    pronunciationStatusMessage,
    pronunciationDetailMessage,
    grammarCorrectionMadeNoChangesToTranscription,
    captureDiagnosticsMessage,
    isTutorSpeaking,
    isTutorPreparingConversationModel,
    isTutorComposingReply,
    formantsSummaryMessage,
    isPreparingModels,
    primaryActivityMessage,
  }
}
