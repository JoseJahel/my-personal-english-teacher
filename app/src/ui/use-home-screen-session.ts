/**
 * Home-screen session: scenario chat shell + mic → ASR → grammar (Avance 2 shell).
 * Presentation lives in `HomeScreen.tsx` and small presentational panels.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { MicrophoneCaptureError, startMicrophoneCapture } from '../audio/microphone-capture'
import type { CaptureDiagnostics, MicrophoneCaptureSession } from '../audio/microphone-capture'
import { isGetUserMediaNative } from '../audio/open-microphone-stream'
import { asrModelCandidates, resolveActiveAsrCandidateId } from '../ia/model-registry'
import { homeScreenInterfaceTexts } from './interface-texts'
import { resampleToWhisperRate } from '../audio/audio-resampler'
import { hasUsableSpeechEnergy } from '../dsp/signal-energy'
import type { FormantTriple } from '../dsp/formant-estimation'
import { createEnergyVoiceActivityDetector } from '../dsp/voice-activity-detection'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import {
  createPracticeSessionRepository,
  type PracticeSessionRepository,
} from '../storage/session-repository'
import { playMonoPcmSamples } from '../audio/play-pcm-mono'
import { awaitWithTimeout } from './await-with-timeout'
import { InferenceClientError } from '../ia/inference-client'
import type { InferenceClient, InferenceClientErrorReason } from '../ia/inference-client'
import { grammarCorrectionMadeNoChanges } from '../ia/grammar-correction'
import { isDegenerateTranscript, isNonSpeechTranscript } from '../ia/transcription-text'
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
import { runPronunciationScoringForUtterance } from './run-pronunciation-scoring'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import {
  createUserTurnSignalSnapshot,
  isCurrentAttemptGeneration,
  type UserTurnSignalSnapshot,
} from './practice-turn-signal-snapshot'
import {
  ensureHomeInferenceClient,
  tutorGenerationStatusFromResult,
  type InferenceInFlightFlags,
} from './home-inference-client'
import {
  buildInitialChatMessagesForScenario,
  buildRecentHistoryTurnsEn,
  createTutorReplyMessage,
  createUserUtteranceMessage,
  type PracticeChatMessage,
} from './practice-chat-messages'
import { getPracticeScenarioById, type PracticeScenarioId } from './practice-scenarios'
import { pickContextualTutorReply } from './tutor-reply-engine'
import { resolveTutorReplyWithFallback } from './tutor-reply-orchestration'
import {
  clearUtteranceSignalViews,
  updateUtteranceSignalViews,
} from './update-utterance-signal-views'
import { clearWaveformCanvas, startAnalyserWaveformAnimation } from './waveform-canvas'
import type { HomeScreenProps } from './HomeScreen'

const DEFAULT_SCENARIO_ID: PracticeScenarioId = 'restaurant'

// WASM synthesis measures ~8 s; 5x margin so a genuinely slow-but-alive
// device is never mistaken for a hung one, while a wedged WebGPU/audio
// driver promise still gets released instead of blocking the mic forever
// (speechSynthesisStatus stuck in 'loading-model'/'synthesizing'/'playing').
const SPEECH_SYNTHESIS_TIMEOUT_MS = 45_000

function nextChatMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Phrase used for tutor intent matching.
 * Prefer grammar output when it keeps the same rough content; keep raw ASR when
 * the corrector empties or heavily rewrites short speech (common with quiet mics).
 */
function pickBestIntentPhrase(rawTranscript: string, correctedText: string): string {
  const raw = rawTranscript.trim()
  const corrected = correctedText.trim()
  if (!corrected) {
    return raw
  }
  if (!raw) {
    return corrected
  }
  const rawWords = raw.toLowerCase().match(/[a-z0-9']+/g) ?? []
  const correctedWords = corrected.toLowerCase().match(/[a-z0-9']+/g) ?? []
  if (rawWords.length === 0) {
    return corrected
  }
  // Corrector invented a long essay from a short ASR line — trust ASR for intents.
  if (rawWords.length <= 6 && correctedWords.length >= rawWords.length * 3) {
    return raw
  }
  return corrected
}

function formatFormantsSummaryMessage(formants: FormantTriple | null): string | null {
  if (!formants) {
    return null
  }
  if (formants.f1InHertz === null && formants.f2InHertz === null && formants.f3InHertz === null) {
    return null
  }
  const formatHz = (value: number | null) =>
    value === null || !Number.isFinite(value) ? '—' : Math.round(value).toString()
  return homeScreenInterfaceTexts.formantsSummary(
    formatHz(formants.f1InHertz),
    formatHz(formants.f2InHertz),
    formatHz(formants.f3InHertz),
  )
}

function resolvePrimaryActivityMessage(input: {
  isTutorSpeaking: boolean
  isStarting: boolean
  isListening: boolean
  isPreparingModels: boolean
  microphoneStatusMessage: string
  tutorGenerationStatus: TutorGenerationUiStatus
  pronunciationStatus: PronunciationUiStatus
  speechSynthesisStatus: SpeechSynthesisUiStatus
  transcriptionStatus: TranscriptionUiStatus
}): string {
  if (input.isStarting) {
    return homeScreenInterfaceTexts.microphoneStatusMessages.starting
  }
  if (input.isListening) {
    return homeScreenInterfaceTexts.microphoneStatusMessages.listening
  }
  if (input.transcriptionStatus === 'transcribing') {
    return homeScreenInterfaceTexts.transcriptionStatusMessages.transcribing
  }
  if (input.transcriptionStatus === 'loading-model') {
    return homeScreenInterfaceTexts.modelsWarmingUpMessage
  }
  if (
    input.tutorGenerationStatus === 'loading-model' ||
    input.tutorGenerationStatus === 'generating'
  ) {
    return homeScreenInterfaceTexts.tutorGeneration.statusGenerating
  }
  if (input.pronunciationStatus === 'scoring') {
    return homeScreenInterfaceTexts.pronunciationStatusMessages.scoring
  }
  if (
    input.speechSynthesisStatus === 'loading-model' ||
    input.speechSynthesisStatus === 'synthesizing' ||
    input.speechSynthesisStatus === 'playing'
  ) {
    return homeScreenInterfaceTexts.speechSynthesisStatusMessages.playing
  }
  if (input.isPreparingModels) {
    return homeScreenInterfaceTexts.modelsWarmingUpMessage
  }
  return input.microphoneStatusMessage
}

function initialChatMessages(scenarioId: PracticeScenarioId): PracticeChatMessage[] {
  return buildInitialChatMessagesForScenario(
    getPracticeScenarioById(scenarioId),
    nextChatMessageId('intro'),
  )
}

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
  const captureSessionRef = useRef<MicrophoneCaptureSession | null>(null)
  const stopWaveformAnimationRef = useRef<(() => void) | null>(null)
  const inferenceClientRef = useRef<InferenceClient | null>(null)
  const inferenceInFlightFlagsRef = useRef<InferenceInFlightFlags>({
    transcription: false,
    grammarCorrection: false,
    speechSynthesis: false,
    tutorGeneration: false,
  })
  const speechPlaybackGenerationRef = useRef(0)
  const lastUserCaptureRef = useRef<{
    samples: Float32Array
    sampleRateInHertz: number
  } | null>(null)
  const pronunciationAttemptGenerationRef = useRef(0)
  const captureAttemptGenerationRef = useRef(0)
  const voiceActivityDetectorRef = useRef(createEnergyVoiceActivityDetector())
  const autoStopTriggeredRef = useRef(false)
  const handleStopButtonClickRef = useRef<() => void>(() => {})
  const practiceRepositoryRef = useRef<PracticeSessionRepository | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const medianFormantsRef = useRef<FormantTriple | null>(null)
  /** Successful user turns in the current scenario (for multi-turn scripts). */
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

  const abortMicrophoneCapture = useCallback(() => {
    stopWaveformAnimationRef.current?.()
    stopWaveformAnimationRef.current = null
    captureSessionRef.current?.abort()
    captureSessionRef.current = null
    setLiveInputLevel01(0)
    setLiveRms(0)
    setLivePeak(0)
    setActiveMicrophoneLabel('')
    setMicrophoneErrorDetail(null)
  }, [])

  const refreshPracticeHistory = useCallback(async () => {
    const repository = practiceRepositoryRef.current
    if (!repository) {
      return
    }
    try {
      const turns = await repository.listRecentTurns(10)
      setPracticeHistoryTurns(turns)
      setPracticeHistoryStatusMessage(homeScreenInterfaceTexts.practiceHistory.statusReady)
    } catch (error) {
      console.warn('Failed to load practice history.', error)
      setPracticeHistoryStatusMessage(homeScreenInterfaceTexts.practiceHistory.statusError)
    }
  }, [])

  const ensurePracticeSession = useCallback(async (scenarioId: PracticeScenarioId) => {
    const repository = practiceRepositoryRef.current
    if (!repository) {
      return
    }
    try {
      const session = await repository.ensureSessionForScenario(scenarioId)
      activeSessionIdRef.current = session.id
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
      // SmolLM2 is heavy (~250 MB): fetch it once a scenario is chosen, not at boot,
      // so the conversation is ready by the time the learner finishes their first turn.
      void inferenceClient.preloadConversationModel().catch((error: unknown) => {
        console.warn('SmolLM2 preload failed; will retry on first tutor reply.', error)
      })
    },
    [ensurePracticeSession, microphoneStatus],
  )

  const speakTutorText = useCallback(async (englishText: string) => {
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

    const playbackGeneration = (speechPlaybackGenerationRef.current += 1)
    inferenceInFlightFlagsRef.current.speechSynthesis = true
    setSpeechSynthesisStatus('synthesizing')
    setSpeechSynthesisErrorReason(null)
    setSpeechModelLoadingProgressPercent(0)

    try {
      const synthesized = await awaitWithTimeout(
        inferenceClient.synthesizeSpeech(englishText),
        SPEECH_SYNTHESIS_TIMEOUT_MS,
        new Error('Tutor speech synthesis timed out.'),
      )
      if (playbackGeneration !== speechPlaybackGenerationRef.current) {
        return
      }
      setSpeechSynthesisStatus('playing')
      await awaitWithTimeout(
        playMonoPcmSamples(synthesized.samples, synthesized.sampleRateInHertz),
        SPEECH_SYNTHESIS_TIMEOUT_MS,
        new Error('Tutor speech playback timed out.'),
      )
      if (playbackGeneration !== speechPlaybackGenerationRef.current) {
        return
      }
      setSpeechSynthesisStatus('done')
    } catch (error) {
      if (playbackGeneration !== speechPlaybackGenerationRef.current) {
        return
      }
      const reason = error instanceof InferenceClientError ? error.reason : 'worker-unavailable'
      setSpeechSynthesisErrorReason(reason)
      setSpeechSynthesisStatus('error')
      console.error(error)
    } finally {
      if (playbackGeneration === speechPlaybackGenerationRef.current) {
        inferenceInFlightFlagsRef.current.speechSynthesis = false
      }
    }
  }, [])

  const scoreUserPronunciation = useCallback(
    async (
      referenceEnglishText: string,
      turnSignalSnapshot: UserTurnSignalSnapshot | null,
    ): Promise<PronunciationScoreResult | null> => {
      if (!turnSignalSnapshot || !inferenceClientRef.current) {
        setPronunciationStatus('unavailable')
        setPronunciationScore(null)
        return null
      }

      const attemptGeneration = (pronunciationAttemptGenerationRef.current += 1)
      setPronunciationStatus('scoring')
      setPronunciationScore(null)

      try {
        const inferenceClient = inferenceClientRef.current
        const result = await runPronunciationScoringForUtterance({
          userSamples: turnSignalSnapshot.samples,
          userSampleRateInHertz: turnSignalSnapshot.sampleRateInHertz,
          referenceEnglishText,
          synthesizeSpeech: (englishText) =>
            awaitWithTimeout(
              inferenceClient.synthesizeSpeech(englishText),
              SPEECH_SYNTHESIS_TIMEOUT_MS,
              new Error('Reference speech synthesis timed out during pronunciation scoring.'),
            ),
        })
        if (
          !isCurrentAttemptGeneration(
            attemptGeneration,
            pronunciationAttemptGenerationRef.current,
          )
        ) {
          return null
        }
        if (!result) {
          setPronunciationStatus('unavailable')
          setPronunciationScore(null)
          return null
        }
        setPronunciationScore(result)
        setPronunciationStatus('done')
        return result
      } catch (error) {
        if (
          !isCurrentAttemptGeneration(
            attemptGeneration,
            pronunciationAttemptGenerationRef.current,
          )
        ) {
          return null
        }
        console.error(error)
        setPronunciationStatus('unavailable')
        setPronunciationScore(null)
        return null
      }
    },
    [],
  )

  const persistPracticeTurn = useCallback(
    async (input: {
      transcribedText: string
      correctedText: string
      tutorReplyText: string
      tutorUsedFallback: boolean
      pronunciation: PronunciationScoreResult | null
      formants: FormantTriple | null
    }) => {
      const repository = practiceRepositoryRef.current
      const sessionId = activeSessionIdRef.current
      if (!repository || !sessionId) {
        return
      }
      try {
        await repository.saveTurn({
          sessionId,
          scenarioId: selectedScenarioIdRef.current,
          transcribedText: input.transcribedText,
          correctedText: input.correctedText,
          tutorReplyText: input.tutorReplyText,
          tutorUsedFallback: input.tutorUsedFallback,
          pronunciationScore0to100: input.pronunciation?.score0to100 ?? null,
          mfccScore0to100: input.pronunciation?.mfccScore0to100 ?? null,
          pitchScore0to100: input.pronunciation?.pitchScore0to100 ?? null,
          formantF1InHertz: input.formants?.f1InHertz ?? null,
          formantF2InHertz: input.formants?.f2InHertz ?? null,
          formantF3InHertz: input.formants?.f3InHertz ?? null,
          wordHighlights: input.pronunciation?.wordHighlights ?? [],
        })
        await refreshPracticeHistory()
      } catch (error) {
        console.warn('Failed to persist practice turn.', error)
        setPracticeHistoryStatusMessage(homeScreenInterfaceTexts.practiceHistory.statusError)
      }
    },
    [refreshPracticeHistory],
  )

  const appendSuccessfulPracticeTurn = useCallback(
    async (
      transcribedTextResult: string,
      correctedText: string,
      turnSignalSnapshot: UserTurnSignalSnapshot,
    ) => {
      const scenario = getPracticeScenarioById(selectedScenarioIdRef.current)
      const userMessage = createUserUtteranceMessage(
        transcribedTextResult,
        correctedText,
        nextChatMessageId('user'),
      )
      const referencePhrase = correctedText.trim() || transcribedTextResult.trim()

      const turnIndex = userTurnIndexRef.current
      userTurnIndexRef.current = turnIndex + 1
      const intentPhrase = pickBestIntentPhrase(transcribedTextResult, correctedText)

      // Regex reply is the instant, always-available fallback — computed up front so
      // the LLM path (and its 10 s timeout) never blocks the conversation from moving.
      const fallbackReplyText = pickContextualTutorReply({
        scenario,
        userUtteranceEn: intentPhrase,
        userTurnIndex: turnIndex,
      })
      const historyTurnsEn = buildRecentHistoryTurnsEn(chatMessagesRef.current)

      setChatMessages((currentMessages) => [...currentMessages, userMessage])
      setTutorGenerationStatus('generating')

      const inferenceClient = inferenceClientRef.current
      inferenceInFlightFlagsRef.current.tutorGeneration = true

      let tutorReplyText = fallbackReplyText
      let usedFallback = true
      try {
        if (inferenceClient) {
          const result = await resolveTutorReplyWithFallback({
            generateTutorReply: inferenceClient.generateTutorReply,
            requestInput: {
              scenarioContextEn: scenario.generationContextEn,
              historyTurnsEn,
              userUtteranceEn: intentPhrase,
              fallbackReplyEn: fallbackReplyText,
            },
          })
          tutorReplyText = result.tutorReplyText
          usedFallback = result.usedFallback
        }
      } finally {
        inferenceInFlightFlagsRef.current.tutorGeneration = false
      }

      setChatMessages((currentMessages) => [
        ...currentMessages,
        createTutorReplyMessage(tutorReplyText, nextChatMessageId('tutor'), usedFallback),
      ])
      setTutorGenerationStatus(tutorGenerationStatusFromResult(usedFallback))

      // Conversation first: speak ASAP. Score is heavy (extra TTS) — run after voice starts.
      // Score/persist use the per-turn snapshot (issue #23), never live shared refs.
      void speakTutorText(tutorReplyText)
      const pronunciation = await scoreUserPronunciation(referencePhrase, turnSignalSnapshot)
      await persistPracticeTurn({
        transcribedText: transcribedTextResult,
        correctedText: referencePhrase,
        tutorReplyText,
        tutorUsedFallback: usedFallback,
        pronunciation,
        formants: turnSignalSnapshot.formants,
      })
    },
    [persistPracticeTurn, scoreUserPronunciation, speakTutorText],
  )

  const correctTranscribedGrammar = useCallback(
    async (
      transcribedTextResult: string,
      attemptGeneration: number,
      turnSignalSnapshot: UserTurnSignalSnapshot,
    ) => {
      if (!transcribedTextResult.trim() || !inferenceClientRef.current) {
        setGrammarCorrectionStatus('idle')
        void appendSuccessfulPracticeTurn(
          transcribedTextResult,
          transcribedTextResult,
          turnSignalSnapshot,
        )
        return
      }

      inferenceInFlightFlagsRef.current.grammarCorrection = true
      setGrammarCorrectionStatus('correcting-grammar')
      setGrammarCorrectionErrorReason(null)

      try {
        const correctedText = await inferenceClientRef.current.correctGrammar(transcribedTextResult)
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }
        setCorrectedGrammarText(correctedText)
        setGrammarCorrectionStatus('done')
        void appendSuccessfulPracticeTurn(
          transcribedTextResult,
          correctedText,
          turnSignalSnapshot,
        )
      } catch (error) {
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }
        const reason = error instanceof InferenceClientError ? error.reason : 'worker-unavailable'
        setGrammarCorrectionErrorReason(reason)
        setGrammarCorrectionStatus('error')
        // Still add the user turn so chat history is not empty after a successful ASR.
        void appendSuccessfulPracticeTurn(
          transcribedTextResult,
          transcribedTextResult,
          turnSignalSnapshot,
        )
        console.error(error)
      } finally {
        if (attemptGeneration === transcriptionAttemptGenerationRef.current) {
          inferenceInFlightFlagsRef.current.grammarCorrection = false
        }
      }
    },
    [appendSuccessfulPracticeTurn],
  )

  const transcribeCapturedAudio = useCallback(
    async (samples: Float32Array, nativeSampleRate: number, diagnostics: CaptureDiagnostics) => {
      setCaptureDiagnostics(diagnostics)

      if (samples.length === 0) {
        lastUserCaptureRef.current = null
        setMedianFormants(null)
        medianFormantsRef.current = null
        clearUtteranceSignalViews({
          spectrogramCanvas: spectrogramCanvasRef.current,
          pitchTrackCanvas: pitchTrackCanvasRef.current,
        })
        setTranscriptionStatus('no-audio')
        setNoAudioReason({ kind: 'empty-recording' })
        setTranscribedText('')
        setTranscriptionErrorReason(null)
        setGrammarCorrectionStatus('idle')
        setCorrectedGrammarText('')
        setGrammarCorrectionErrorReason(null)
        setPronunciationStatus('idle')
        setPronunciationScore(null)
        return
      }

      if (!hasUsableSpeechEnergy(samples, nativeSampleRate)) {
        lastUserCaptureRef.current = null
        // Still show signals so the student sees energy/pitch of a weak capture.
        const weakFormants = updateUtteranceSignalViews({
          samples,
          sampleRateInHertz: nativeSampleRate,
          spectrogramCanvas: spectrogramCanvasRef.current,
          pitchTrackCanvas: pitchTrackCanvasRef.current,
        })
        setHasCompletedCapture(true)
        setMedianFormants(weakFormants)
        medianFormantsRef.current = weakFormants
        setTranscriptionStatus('no-audio')
        setNoAudioReason({ kind: 'low-energy', diagnostics })
        setTranscribedText('')
        setTranscriptionErrorReason(null)
        setGrammarCorrectionStatus('idle')
        setCorrectedGrammarText('')
        setGrammarCorrectionErrorReason(null)
        setPronunciationStatus('idle')
        setPronunciationScore(null)
        return
      }

      // Snapshot by value at end of usable capture (issue #23). Later turns may
      // overwrite shared refs; score/persist must keep this turn's PCM/formants.
      pronunciationAttemptGenerationRef.current += 1
      setHasCompletedCapture(true)
      const formants = updateUtteranceSignalViews({
        samples,
        sampleRateInHertz: nativeSampleRate,
        spectrogramCanvas: spectrogramCanvasRef.current,
        pitchTrackCanvas: pitchTrackCanvasRef.current,
      })
      const turnSignalSnapshot = createUserTurnSignalSnapshot(
        samples,
        nativeSampleRate,
        formants,
      )
      lastUserCaptureRef.current = {
        samples: turnSignalSnapshot.samples,
        sampleRateInHertz: turnSignalSnapshot.sampleRateInHertz,
      }
      setMedianFormants(formants)
      medianFormantsRef.current = formants

      const samples16kHz = resampleToWhisperRate(samples, nativeSampleRate)

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

      const attemptGeneration = (transcriptionAttemptGenerationRef.current += 1)
      inferenceInFlightFlagsRef.current.transcription = true
      setTranscriptionStatus('transcribing')
      setNoAudioReason(null)
      setTranscriptionErrorReason(null)
      setGrammarCorrectionStatus('idle')
      setGrammarCorrectionErrorReason(null)
      setCorrectedGrammarText('')

      try {
        const transcribedTextResult = await inferenceClient.transcribe(samples16kHz)
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }

        const audioDurationSeconds = samples16kHz.length / 16000
        if (isNonSpeechTranscript(transcribedTextResult)) {
          lastUserCaptureRef.current = null
          setTranscriptionStatus('no-audio')
          setNoAudioReason({
            kind: 'non-speech',
            whisperRawText: transcribedTextResult || '(vacío)',
          })
          setTranscribedText('')
          setTranscriptionErrorReason(null)
          setGrammarCorrectionStatus('idle')
          setCorrectedGrammarText('')
          setGrammarCorrectionErrorReason(null)
          setPronunciationStatus('idle')
          setPronunciationScore(null)
          return
        }

        if (isDegenerateTranscript(transcribedTextResult, audioDurationSeconds)) {
          lastUserCaptureRef.current = null
          setTranscriptionStatus('no-audio')
          setNoAudioReason({
            kind: 'degenerate',
            previewText: transcribedTextResult.slice(0, 80),
          })
          setTranscribedText('')
          setTranscriptionErrorReason(null)
          setGrammarCorrectionStatus('idle')
          setCorrectedGrammarText('')
          setGrammarCorrectionErrorReason(null)
          setPronunciationStatus('idle')
          setPronunciationScore(null)
          return
        }

        setTranscribedText(transcribedTextResult)
        setTranscriptionStatus('done')
        void correctTranscribedGrammar(
          transcribedTextResult,
          attemptGeneration,
          turnSignalSnapshot,
        )
      } catch (error) {
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }
        const reason = error instanceof InferenceClientError ? error.reason : 'worker-unavailable'
        setTranscriptionErrorReason(reason)
        setTranscriptionStatus('error')
        console.error(error)
      } finally {
        if (attemptGeneration === transcriptionAttemptGenerationRef.current) {
          inferenceInFlightFlagsRef.current.transcription = false
        }
      }
    },
    [correctTranscribedGrammar],
  )

  const handleStartButtonClick = useCallback(async () => {
    // Half-duplex: cancel in-flight tutor playback when the user starts speaking.
    speechPlaybackGenerationRef.current += 1
    inferenceInFlightFlagsRef.current.speechSynthesis = false
    setSpeechSynthesisStatus('idle')

    const attemptGeneration = (captureAttemptGenerationRef.current += 1)
    setMicrophoneStatus('starting')
    setTranscriptionStatus('idle')
    setTranscribedText('')
    setTranscriptionErrorReason(null)
    setNoAudioReason(null)
    setCaptureDiagnostics(null)
    setModelLoadingProgressPercent(0)
    setGrammarCorrectionStatus('idle')
    setCorrectedGrammarText('')
    setGrammarCorrectionErrorReason(null)
    setGrammarModelLoadingProgressPercent(0)
    setLiveInputLevel01(0)
    setLiveRms(0)
    setLivePeak(0)
    setActiveMicrophoneLabel('')
    setMicrophoneErrorDetail(null)

    try {
      const captureSession = await startMicrophoneCapture()

      if (attemptGeneration !== captureAttemptGenerationRef.current) {
        captureSession.abort()
        setMicrophoneStatus((status) => (status === 'starting' ? 'idle' : status))
        return
      }

      captureSessionRef.current = captureSession
      setActiveMicrophoneLabel(captureSession.deviceLabel)
      setMicrophoneStatus('listening')
      voiceActivityDetectorRef.current.reset()
      autoStopTriggeredRef.current = false

      const canvas = canvasRef.current
      if (canvas) {
        let lastLevelUiUpdateMs = 0
        stopWaveformAnimationRef.current = startAnalyserWaveformAnimation(
          canvas,
          captureSession.analyserNode,
          {
            onMeters: ({ rms, peak, level01 }) => {
              const nowMs = performance.now()
              if (nowMs - lastLevelUiUpdateMs >= 80) {
                lastLevelUiUpdateMs = nowMs
                setLiveInputLevel01(level01)
                setLiveRms(rms)
                setLivePeak(peak)
              }

              // Energy VAD: auto-stop after speech + hangover silence (or max duration).
              const vadResult = voiceActivityDetectorRef.current.pushFrame({ rms, peak }, nowMs)
              if (vadResult.shouldAutoStop && !autoStopTriggeredRef.current) {
                autoStopTriggeredRef.current = true
                handleStopButtonClickRef.current()
              }
            },
          },
        )
      }
    } catch (error) {
      if (attemptGeneration !== captureAttemptGenerationRef.current) {
        return
      }

      const isPermissionDenied =
        error instanceof MicrophoneCaptureError && error.reason === 'permission-denied'
      setMicrophoneStatus(isPermissionDenied ? 'permission-denied' : 'error')
      if (error instanceof Error && error.message.trim().length > 0) {
        setMicrophoneErrorDetail(error.message)
      } else {
        setMicrophoneErrorDetail(null)
      }
      console.error(error)
    }
  }, [])

  const handleStopButtonClick = useCallback(() => {
    const session = captureSessionRef.current
    captureSessionRef.current = null

    stopWaveformAnimationRef.current?.()
    stopWaveformAnimationRef.current = null
    captureAttemptGenerationRef.current += 1
    setLiveInputLevel01(0)
    setLiveRms(0)
    setLivePeak(0)

    if (canvasRef.current) {
      clearWaveformCanvas(canvasRef.current)
    }
    setMicrophoneStatus('stopped')

    if (!session) {
      return
    }

    void (async () => {
      try {
        const capturedAudio = await session.stop()
        await transcribeCapturedAudio(
          capturedAudio.samples,
          capturedAudio.sampleRate,
          capturedAudio.diagnostics,
        )
      } catch (error) {
        setTranscriptionStatus('error')
        setTranscriptionErrorReason(
          error instanceof InferenceClientError ? error.reason : 'transcription-failed',
        )
        console.error(error)
      }
    })()
  }, [transcribeCapturedAudio])

  useEffect(() => {
    handleStopButtonClickRef.current = handleStopButtonClick
  }, [handleStopButtonClick])

  useEffect(() => {
    return () => {
      abortMicrophoneCapture()
    }
  }, [abortMicrophoneCapture])

  useEffect(() => {
    return () => {
      inferenceClientRef.current?.dispose()
      inferenceClientRef.current = null
    }
  }, [])

  // IndexedDB practice history (soft-fail if unavailable).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!globalThis.indexedDB) {
          setPracticeHistoryStatusMessage(
            homeScreenInterfaceTexts.practiceHistory.statusUnavailable,
          )
          return
        }
        const repository = await createPracticeSessionRepository()
        if (cancelled) {
          repository.close()
          return
        }
        practiceRepositoryRef.current = repository
        const session = await repository.ensureSessionForScenario(selectedScenarioIdRef.current)
        activeSessionIdRef.current = session.id
        const turns = await repository.listRecentTurns(10)
        if (!cancelled) {
          setPracticeHistoryTurns(turns)
          setPracticeHistoryStatusMessage(homeScreenInterfaceTexts.practiceHistory.statusReady)
        }
      } catch (error) {
        console.warn('Practice IndexedDB init failed.', error)
        if (!cancelled) {
          setPracticeHistoryStatusMessage(
            homeScreenInterfaceTexts.practiceHistory.statusUnavailable,
          )
        }
      }
    })()

    return () => {
      cancelled = true
      practiceRepositoryRef.current?.close()
      practiceRepositoryRef.current = null
    }
  }, [])

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

    let cancelled = false
    void inferenceClient.preloadModels().catch((error: unknown) => {
      if (!cancelled) {
        console.warn('Background model preload failed; will retry on first use.', error)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

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

  const microphoneStatusMessage = microphoneStatusMessageFor(
    microphoneStatus,
    microphoneErrorDetail,
  )
  const transcriptionStatusMessage = transcriptionStatusMessageFor(
    transcriptionStatus,
    modelLoadingProgressPercent,
    transcriptionErrorReason,
    noAudioReason,
    asrModelCandidates[resolveActiveAsrCandidateId()].approxDownloadMb,
  )
  const grammarCorrectionStatusMessage = grammarCorrectionStatusMessageFor(
    grammarCorrectionStatus,
    grammarModelLoadingProgressPercent,
    grammarCorrectionErrorReason,
  )
  const speechSynthesisStatusMessage = speechSynthesisStatusMessageFor(
    speechSynthesisStatus,
    speechModelLoadingProgressPercent,
    speechSynthesisErrorReason,
  )
  const tutorGenerationStatusMessage = tutorGenerationStatusMessageFor(
    tutorGenerationStatus,
    tutorModelLoadingProgressPercent,
  )
  const pronunciationStatusMessage = pronunciationStatusMessageFor(
    pronunciationStatus,
    pronunciationScore?.score0to100 ?? null,
  )
  const pronunciationDetailMessage =
    pronunciationStatus === 'done' && pronunciationScore
      ? homeScreenInterfaceTexts.pronunciationStatusMessages.detail({
          mfccScore: pronunciationScore.mfccScore0to100,
          pitchScore: pronunciationScore.pitchScore0to100,
          userFrames: pronunciationScore.userMfccFrameCount,
          referenceFrames: pronunciationScore.referenceMfccFrameCount,
        })
      : null
  const grammarCorrectionMadeNoChangesToTranscription =
    grammarCorrectionStatus === 'done' &&
    grammarCorrectionMadeNoChanges(transcribedText, correctedGrammarText)

  const captureDiagnosticsMessage =
    captureDiagnostics && transcriptionStatus === 'no-audio'
      ? captureDiagnosticsMessageFor(captureDiagnostics)
      : null

  const isTutorSpeaking =
    tutorGenerationStatus === 'loading-model' ||
    tutorGenerationStatus === 'generating' ||
    speechSynthesisStatus === 'loading-model' ||
    speechSynthesisStatus === 'synthesizing' ||
    speechSynthesisStatus === 'playing'

  const isTutorPreparingConversationModel =
    shouldShowTutorModelPreparingBanner(tutorGenerationStatus)
  const isTutorComposingReply = shouldShowTutorTypingIndicator(tutorGenerationStatus)

  const formantsSummaryMessage = formatFormantsSummaryMessage(medianFormants)

  const isPreparingModels =
    transcriptionStatus === 'loading-model' || grammarCorrectionStatus === 'loading-model'

  const primaryActivityMessage = resolvePrimaryActivityMessage({
    isTutorSpeaking,
    isStarting,
    isListening,
    isPreparingModels,
    microphoneStatusMessage,
    tutorGenerationStatus,
    pronunciationStatus,
    speechSynthesisStatus,
    transcriptionStatus,
  })

  return {
    canvasRef,
    spectrogramCanvasRef,
    pitchTrackCanvasRef,
    isStarting,
    isListening,
    isTutorSpeaking,
    hasCompletedCapture,
    primaryActivityMessage,
    isPreparingModels,
    liveInputLevel01,
    liveRms,
    livePeak,
    activeMicrophoneLabel,
    environmentDiagnosticsMessage,
    microphoneStatusMessage,
    transcriptionStatusMessage,
    transcribedText,
    captureDiagnosticsMessage,
    grammarCorrectionStatusMessage,
    correctedGrammarText,
    grammarCorrectionMadeNoChangesToTranscription,
    speechSynthesisStatusMessage,
    tutorGenerationStatusMessage,
    isTutorPreparingConversationModel,
    isTutorComposingReply,
    pronunciationStatusMessage,
    pronunciationDetailMessage,
    pronunciationScore0to100: pronunciationScore?.score0to100 ?? null,
    pronunciationWordHighlights: pronunciationScore?.wordHighlights ?? [],
    formantsSummaryMessage,
    practiceHistoryTurns,
    practiceHistoryStatusMessage,
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
