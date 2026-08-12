/**
 * Home-screen session: wires scenario UI state, mic, and utterance pipeline.
 * Presentation lives in `HomeScreen.tsx` and small presentational panels.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptureDiagnostics } from '../audio/microphone-capture'
import { isGetUserMediaNative } from '../audio/open-microphone-stream'
import type { FormantTriple } from '../dsp/formant-estimation'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import type { InferenceClient, InferenceClientErrorReason } from '../ia/inference-client'
import { createModelLoadHistory } from '../storage/model-load-history'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import type { PracticeSessionRepository } from '../storage/session-repository'
import { buildHomeScreenViewModel } from './build-home-screen-view-model'
import type { SpokenProgress } from './spoken-progress'
import {
  ensureHomeInferenceClient,
  type InferenceInFlightFlags,
} from './home-inference-client'
import type {
  GrammarCorrectionUiStatus,
  MicrophoneUiStatus,
  NoAudioReason,
  PronunciationUiStatus,
  SpeechSynthesisUiStatus,
  TranscriptionUiStatus,
  TutorGenerationUiStatus,
} from './home-screen-status'
import { DEFAULT_SCENARIO_ID, initialChatMessages } from './home-session-helpers'
import { homeScreenInterfaceTexts } from './interface-texts'
import {
  offlineReadinessMessageFor,
  resolveOfflineReadiness,
  type OfflineReadiness,
} from './offline-readiness'
import type { PracticeChatMessage } from './practice-chat-messages'
import { getPracticeScenarioById, type PracticeScenarioId } from './practice-scenarios'
import { clearUtteranceSignalViews } from './update-utterance-signal-views'
import { useHomeMicrophoneSession } from './use-home-microphone-session'
import { useHomeUtterancePipeline } from './use-home-utterance-pipeline'
import { usePracticeHistoryBootstrap } from './use-practice-history-bootstrap'
import type { HomeScreenProps } from './HomeScreen'

export function useHomeScreenSession(): HomeScreenProps {
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<PracticeScenarioId>(DEFAULT_SCENARIO_ID)
  const [chatMessages, setChatMessages] = useState<PracticeChatMessage[]>(() =>
    initialChatMessages(DEFAULT_SCENARIO_ID),
  )
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneUiStatus>('idle')
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionUiStatus>('idle')
  const [modelLoadingProgressPercent, setModelLoadingProgressPercent] = useState(0)
  const [transcribedText, setTranscribedText] = useState('')
  const [transcriptionErrorReason, setTranscriptionErrorReason] =
    useState<InferenceClientErrorReason | null>(null)
  const [noAudioReason, setNoAudioReason] = useState<NoAudioReason | null>(null)
  const [captureDiagnostics, setCaptureDiagnostics] = useState<CaptureDiagnostics | null>(null)
  const [grammarCorrectionStatus, setGrammarCorrectionStatus] =
    useState<GrammarCorrectionUiStatus>('idle')
  const [grammarModelLoadingProgressPercent, setGrammarModelLoadingProgressPercent] = useState(0)
  const [correctedGrammarText, setCorrectedGrammarText] = useState('')
  const [grammarCorrectionErrorReason, setGrammarCorrectionErrorReason] =
    useState<InferenceClientErrorReason | null>(null)
  const [speechSynthesisStatus, setSpeechSynthesisStatus] =
    useState<SpeechSynthesisUiStatus>('idle')
  const [speechModelLoadingProgressPercent, setSpeechModelLoadingProgressPercent] = useState(0)
  const [speechSynthesisErrorReason, setSpeechSynthesisErrorReason] =
    useState<InferenceClientErrorReason | null>(null)
  const [pronunciationStatus, setPronunciationStatus] = useState<PronunciationUiStatus>('idle')
  const [pronunciationScore, setPronunciationScore] = useState<PronunciationScoreResult | null>(
    null,
  )
  const [tutorGenerationStatus, setTutorGenerationStatus] =
    useState<TutorGenerationUiStatus>('idle')
  const [tutorModelLoadingProgressPercent, setTutorModelLoadingProgressPercent] = useState(0)
  const [medianFormants, setMedianFormants] = useState<FormantTriple | null>(null)
  const [practiceHistoryTurns, setPracticeHistoryTurns] = useState<PracticeTurnRecord[]>([])
  const [practiceHistoryStatusMessage, setPracticeHistoryStatusMessage] = useState<string>(
    homeScreenInterfaceTexts.practiceHistory.statusReady,
  )
  const [hasCompletedCapture, setHasCompletedCapture] = useState(false)
  const [modelLoadHistory] = useState(() => createModelLoadHistory())
  const [offlineReadiness, setOfflineReadiness] = useState<OfflineReadiness>(() =>
    resolveOfflineReadiness(modelLoadHistory.snapshot()),
  )
  const [liveInputLevel01, setLiveInputLevel01] = useState(0)
  const [liveRms, setLiveRms] = useState(0)
  const [livePeak, setLivePeak] = useState(0)
  const [activeMicrophoneLabel, setActiveMicrophoneLabel] = useState('')
  const [microphoneErrorDetail, setMicrophoneErrorDetail] = useState<string | null>(null)
  const [environmentDiagnosticsMessage, setEnvironmentDiagnosticsMessage] = useState<string | null>(
    null,
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pitchTrackCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const inferenceClientRef = useRef<InferenceClient | null>(null)
  const inferenceInFlightFlagsRef = useRef<InferenceInFlightFlags>({
    transcription: false,
    grammarCorrection: false,
    speechSynthesis: false,
    tutorGeneration: false,
  })
  const speechPlaybackGenerationRef = useRef(0)
  const speechPlaybackAbortControllerRef = useRef<AbortController | null>(null)
  const pendingSpokenProgressRef = useRef<SpokenProgress | null>(null)
  const lastUserCaptureRef = useRef<{
    samples: Float32Array
    sampleRateInHertz: number
  } | null>(null)
  const pronunciationAttemptGenerationRef = useRef(0)
  const practiceRepositoryRef = useRef<PracticeSessionRepository | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const medianFormantsRef = useRef<FormantTriple | null>(null)
  const userTurnIndexRef = useRef(0)
  const transcriptionAttemptGenerationRef = useRef(0)
  const selectedScenarioIdRef = useRef<PracticeScenarioId>(DEFAULT_SCENARIO_ID)
  const chatMessagesRef = useRef<PracticeChatMessage[]>(chatMessages)

  const isStarting = microphoneStatus === 'starting'
  const isListening = microphoneStatus === 'listening'
  const firstTurnHintEn = getPracticeScenarioById(selectedScenarioId).firstTurnHintEn

  useEffect(() => {
    selectedScenarioIdRef.current = selectedScenarioId
  }, [selectedScenarioId])
  useEffect(() => {
    chatMessagesRef.current = chatMessages
  }, [chatMessages])

  const pipelineDeps = {
    inferenceClientRef,
    inferenceInFlightFlagsRef,
    speechPlaybackGenerationRef,
    speechPlaybackAbortControllerRef,
    pendingSpokenProgressRef,
    lastUserCaptureRef,
    pronunciationAttemptGenerationRef,
    transcriptionAttemptGenerationRef,
    practiceRepositoryRef,
    activeSessionIdRef,
    medianFormantsRef,
    userTurnIndexRef,
    selectedScenarioIdRef,
    chatMessagesRef,
    spectrogramCanvasRef,
    pitchTrackCanvasRef,
    setTranscriptionStatus,
    setModelLoadingProgressPercent,
    setGrammarCorrectionStatus,
    setGrammarModelLoadingProgressPercent,
    setSpeechSynthesisStatus,
    setSpeechModelLoadingProgressPercent,
    setTutorGenerationStatus,
    setTutorModelLoadingProgressPercent,
    setSpeechSynthesisErrorReason,
    setPronunciationStatus,
    setPronunciationScore,
    setPracticeHistoryTurns,
    setPracticeHistoryStatusMessage,
    setChatMessages,
    setCaptureDiagnostics,
    setMedianFormants,
    setHasCompletedCapture,
    setNoAudioReason,
    setTranscribedText,
    setTranscriptionErrorReason,
    setCorrectedGrammarText,
    setGrammarCorrectionErrorReason,
  }

  const { transcribeCapturedAudio } = useHomeUtterancePipeline(pipelineDeps)
  const setSpeechSynthesisStatusIdle = useCallback(() => {
    setSpeechSynthesisStatus('idle')
  }, [])

  const { handleStartButtonClick, handleStopButtonClick } = useHomeMicrophoneSession({
    canvasRef,
    speechPlaybackGenerationRef,
    speechPlaybackAbortControllerRef,
    inferenceInFlightFlagsRef,
    setSpeechSynthesisStatusIdle,
    setMicrophoneStatus,
    setTranscriptionStatus,
    setTranscribedText,
    setTranscriptionErrorReason,
    setNoAudioReason,
    setCaptureDiagnostics,
    setModelLoadingProgressPercent,
    setGrammarCorrectionStatus,
    setCorrectedGrammarText,
    setGrammarCorrectionErrorReason,
    setGrammarModelLoadingProgressPercent,
    setLiveInputLevel01,
    setLiveRms,
    setLivePeak,
    setActiveMicrophoneLabel,
    setMicrophoneErrorDetail,
    transcribeCapturedAudio,
  })

  const ensurePracticeSession = useCallback(async (scenarioId: PracticeScenarioId) => {
    const repository = practiceRepositoryRef.current
    if (!repository) {
      return
    }
    try {
      const session = await repository.ensureSessionForScenario(scenarioId)
      activeSessionIdRef.current = session.id
      // Case D (#46): restore pending spoken_progress after reload.
      pendingSpokenProgressRef.current = session.pendingSpokenProgress
    } catch (error) {
      console.warn('Failed to ensure practice session.', error)
      setPracticeHistoryStatusMessage(homeScreenInterfaceTexts.practiceHistory.statusError)
    }
  }, [])

  const handleSelectScenario = useCallback(
    (scenarioId: PracticeScenarioId) => {
      if (microphoneStatus === 'starting' || microphoneStatus === 'listening') {
        return
      }
      setSelectedScenarioId(scenarioId)
      setChatMessages(initialChatMessages(scenarioId))
      setTranscriptionStatus('idle')
      setTranscribedText('')
      setTranscriptionErrorReason(null)
      setNoAudioReason(null)
      setCaptureDiagnostics(null)
      setGrammarCorrectionStatus('idle')
      setCorrectedGrammarText('')
      setGrammarCorrectionErrorReason(null)
      setPronunciationStatus('idle')
      setPronunciationScore(null)
      setMedianFormants(null)
      medianFormantsRef.current = null
      lastUserCaptureRef.current = null
      userTurnIndexRef.current = 0
      clearUtteranceSignalViews({
        spectrogramCanvas: spectrogramCanvasRef.current,
        pitchTrackCanvas: pitchTrackCanvasRef.current,
      })
      void ensurePracticeSession(scenarioId)
      const inferenceClient = ensureHomeInferenceClient(
        inferenceClientRef,
        inferenceInFlightFlagsRef,
        setTranscriptionStatus,
        setModelLoadingProgressPercent,
        setGrammarCorrectionStatus,
        setGrammarModelLoadingProgressPercent,
        setSpeechSynthesisStatus,
        setSpeechModelLoadingProgressPercent,
        setTutorGenerationStatus,
        setTutorModelLoadingProgressPercent,
      )
      void inferenceClient.preloadConversationModel().catch((error: unknown) => {
        console.warn('SmolLM2 preload failed; will retry on first tutor reply.', error)
      })
    },
    [ensurePracticeSession, microphoneStatus],
  )

  useEffect(() => {
    return () => {
      inferenceClientRef.current?.dispose()
      inferenceClientRef.current = null
    }
  }, [])

  usePracticeHistoryBootstrap({
    practiceRepositoryRef,
    activeSessionIdRef,
    selectedScenarioIdRef,
    setPracticeHistoryTurns,
    setPracticeHistoryStatusMessage,
  })

  useEffect(() => {
    const inferenceClient = ensureHomeInferenceClient(
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      setTranscriptionStatus,
      setModelLoadingProgressPercent,
      setGrammarCorrectionStatus,
      setGrammarModelLoadingProgressPercent,
      setSpeechSynthesisStatus,
      setSpeechModelLoadingProgressPercent,
      setTutorGenerationStatus,
      setTutorModelLoadingProgressPercent,
    )
    const unsubscribeFromModelReady = inferenceClient.subscribeToModelReady((readyMessage) => {
      modelLoadHistory.markLoaded(readyMessage.modelKey)
      setOfflineReadiness(resolveOfflineReadiness(modelLoadHistory.snapshot()))
    })
    let cancelled = false
    void inferenceClient.preloadModels().catch((error: unknown) => {
      if (!cancelled) {
        console.warn('Background model preload failed; will retry on first use.', error)
      }
    })
    return () => {
      cancelled = true
      unsubscribeFromModelReady()
    }
  }, [modelLoadHistory])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const native = isGetUserMediaNative()
      let devicesSummary = 'Dispositivos: (sin listar)'
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const inputs = devices.filter((d) => d.kind === 'audioinput')
          devicesSummary =
            inputs.length === 0
              ? 'Dispositivos audioinput: ninguno listado'
              : `Dispositivos: ${inputs.map((d) => d.label || d.deviceId.slice(0, 8)).join(' | ')}`
        }
      } catch {
        devicesSummary = 'Dispositivos: no se pudieron listar'
      }
      if (!cancelled) {
        setEnvironmentDiagnosticsMessage(
          homeScreenInterfaceTexts.environmentDiagnostics(native, devicesSummary),
        )
      }
    }
    void refresh()
    return () => {
      cancelled = true
    }
  }, [])

  const viewModel = buildHomeScreenViewModel({
    microphoneStatus,
    microphoneErrorDetail,
    transcriptionStatus,
    modelLoadingProgressPercent,
    transcriptionErrorReason,
    noAudioReason,
    grammarCorrectionStatus,
    grammarModelLoadingProgressPercent,
    grammarCorrectionErrorReason,
    speechSynthesisStatus,
    speechModelLoadingProgressPercent,
    speechSynthesisErrorReason,
    tutorGenerationStatus,
    tutorModelLoadingProgressPercent,
    pronunciationStatus,
    pronunciationScore,
    transcribedText,
    correctedGrammarText,
    captureDiagnostics,
    medianFormants,
    isStarting,
    isListening,
  })

  return {
    canvasRef,
    spectrogramCanvasRef,
    pitchTrackCanvasRef,
    isStarting,
    isListening,
    isTutorSpeaking: viewModel.isTutorSpeaking,
    hasCompletedCapture,
    primaryActivityMessage: viewModel.primaryActivityMessage,
    isPreparingModels: viewModel.isPreparingModels,
    offlineReadinessMessage: offlineReadinessMessageFor(offlineReadiness),
    liveInputLevel01,
    liveRms,
    livePeak,
    activeMicrophoneLabel,
    environmentDiagnosticsMessage,
    microphoneStatusMessage: viewModel.microphoneStatusMessage,
    transcriptionStatusMessage: viewModel.transcriptionStatusMessage,
    transcribedText,
    captureDiagnosticsMessage: viewModel.captureDiagnosticsMessage,
    grammarCorrectionStatusMessage: viewModel.grammarCorrectionStatusMessage,
    correctedGrammarText,
    grammarCorrectionMadeNoChangesToTranscription:
      viewModel.grammarCorrectionMadeNoChangesToTranscription,
    speechSynthesisStatusMessage: viewModel.speechSynthesisStatusMessage,
    tutorGenerationStatusMessage: viewModel.tutorGenerationStatusMessage,
    isTutorPreparingConversationModel: viewModel.isTutorPreparingConversationModel,
    isTutorComposingReply: viewModel.isTutorComposingReply,
    pronunciationStatusMessage: viewModel.pronunciationStatusMessage,
    pronunciationDetailMessage: viewModel.pronunciationDetailMessage,
    pronunciationScore0to100: pronunciationScore?.score0to100 ?? null,
    pronunciationMfccScore0to100: pronunciationScore?.mfccScore0to100 ?? null,
    pronunciationPitchScore0to100: pronunciationScore?.pitchScore0to100 ?? null,
    pronunciationWordHighlights: pronunciationScore?.wordHighlights ?? [],
    formantsSummaryMessage: viewModel.formantsSummaryMessage,
    practiceHistoryTurns,
    practiceHistoryStatusMessage,
    offlineReadiness,
    selectedScenarioId,
    chatMessages,
    firstTurnHintEn,
    onSelectScenario: handleSelectScenario,
    onStartMicrophone: () => {
      void handleStartButtonClick()
    },
    onStopMicrophone: handleStopButtonClick,
  }
}
