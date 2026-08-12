/**
 * Shared dependency bag for home utterance pipeline hooks.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CaptureDiagnostics } from '../audio/microphone-capture'
import type { FormantTriple } from '../dsp/formant-estimation'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import type { InferenceClient, InferenceClientErrorReason } from '../ia/inference-client'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import type { PracticeSessionRepository } from '../storage/session-repository'
import type { InferenceInFlightFlags } from './home-inference-client'
import type {
  GrammarCorrectionUiStatus,
  NoAudioReason,
  PronunciationUiStatus,
  SpeechSynthesisUiStatus,
  TranscriptionUiStatus,
  TutorGenerationUiStatus,
} from './home-screen-status'
import type { PracticeChatMessage } from './practice-chat-messages'
import type { PracticeScenarioId } from './practice-scenarios'
import type { CommunicationSuggestion } from '../ia/communication-suggestions'
export interface HomeUtterancePipelineDeps {
  readonly inferenceClientRef: MutableRefObject<InferenceClient | null>
  readonly inferenceInFlightFlagsRef: MutableRefObject<InferenceInFlightFlags>
  readonly speechPlaybackGenerationRef: MutableRefObject<number>
  readonly lastUserCaptureRef: MutableRefObject<{
    samples: Float32Array
    sampleRateInHertz: number
  } | null>
  readonly pronunciationAttemptGenerationRef: MutableRefObject<number>
  readonly transcriptionAttemptGenerationRef: MutableRefObject<number>
  readonly practiceRepositoryRef: MutableRefObject<PracticeSessionRepository | null>
  readonly activeSessionIdRef: MutableRefObject<string | null>
  readonly medianFormantsRef: MutableRefObject<FormantTriple | null>
  readonly userTurnIndexRef: MutableRefObject<number>
  readonly selectedScenarioIdRef: MutableRefObject<PracticeScenarioId>
  readonly chatMessagesRef: MutableRefObject<PracticeChatMessage[]>
  readonly spectrogramCanvasRef: MutableRefObject<HTMLCanvasElement | null>
  readonly pitchTrackCanvasRef: MutableRefObject<HTMLCanvasElement | null>
  readonly setTranscriptionStatus: Dispatch<SetStateAction<TranscriptionUiStatus>>
  readonly setModelLoadingProgressPercent: Dispatch<SetStateAction<number>>
  readonly setGrammarCorrectionStatus: Dispatch<SetStateAction<GrammarCorrectionUiStatus>>
  readonly setGrammarModelLoadingProgressPercent: Dispatch<SetStateAction<number>>
  readonly setSpeechSynthesisStatus: Dispatch<SetStateAction<SpeechSynthesisUiStatus>>
  readonly setSpeechModelLoadingProgressPercent: Dispatch<SetStateAction<number>>
  readonly setTutorGenerationStatus: Dispatch<SetStateAction<TutorGenerationUiStatus>>
  readonly setTutorModelLoadingProgressPercent: Dispatch<SetStateAction<number>>
  readonly setSpeechSynthesisErrorReason: Dispatch<
    SetStateAction<InferenceClientErrorReason | null>
  >
  readonly setPronunciationStatus: Dispatch<SetStateAction<PronunciationUiStatus>>
  readonly setPronunciationScore: Dispatch<SetStateAction<PronunciationScoreResult | null>>
  readonly setPracticeHistoryTurns: Dispatch<SetStateAction<PracticeTurnRecord[]>>
  readonly setPracticeHistoryStatusMessage: Dispatch<SetStateAction<string>>
  readonly setChatMessages: Dispatch<SetStateAction<PracticeChatMessage[]>>
  readonly setCaptureDiagnostics: Dispatch<SetStateAction<CaptureDiagnostics | null>>
  readonly setMedianFormants: Dispatch<SetStateAction<FormantTriple | null>>
  readonly setHasCompletedCapture: Dispatch<SetStateAction<boolean>>
  readonly setNoAudioReason: Dispatch<SetStateAction<NoAudioReason | null>>
  readonly setTranscribedText: Dispatch<SetStateAction<string>>
  readonly setTranscriptionErrorReason: Dispatch<
    SetStateAction<InferenceClientErrorReason | null>
  >
  readonly setCorrectedGrammarText: Dispatch<SetStateAction<string>>
  readonly setGrammarCorrectionErrorReason: Dispatch<
    SetStateAction<InferenceClientErrorReason | null>
  >
  readonly setCommunicationSuggestions: Dispatch
    SetStateAction<readonly CommunicationSuggestion[]>
  >
}
