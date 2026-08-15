/**
 * Tutor reply, TTS, pronunciation score, and IndexedDB persist for one turn.
 * Includes barge-in spoken_progress handling (issue #46).
 */

import { useCallback } from 'react'
import { buildCommunicationSuggestions } from '../ia/communication-suggestions'
import type { FormantTriple } from '../dsp/formant-estimation'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import type { StoredSpokenProgress } from '../storage/practice-session-types'
import {
  ensureHomeInferenceClient,
  tutorGenerationStatusFromResult,
} from './home-inference-client'
import type { HomeUtterancePipelineDeps } from './home-utterance-pipeline-deps'
import {
  SPEECH_SYNTHESIS_TIMEOUT_MS,
  nextChatMessageId,
  pickBestIntentPhrase,
} from './home-session-helpers'
import { resolvePostInterruptionTutorReply } from './interruption-resume-bridges'
import { homeScreenInterfaceTexts } from './interface-texts'
import {
  buildRecentHistoryTurnsEn,
  createTutorReplyMessage,
  createUserUtteranceMessage,
} from './practice-chat-messages'
import { getPracticeScenarioById } from './practice-scenarios'
import {
  isCurrentAttemptGeneration,
  type UserTurnSignalSnapshot,
} from './practice-turn-signal-snapshot'
import {
  publishUserUtteranceThenResolveTutor,
  resolvePracticeTutorReply,
} from './progressive-tutor-turn'
import {
  resolveConversationPronunciationSkipStatus,
  resolvePronunciationScoreEligibilityFromCapture,
} from './pronunciation-score-eligibility'
import { runPronunciationScoringForUtterance } from './run-pronunciation-scoring'
import type { SpokenProgress } from './spoken-progress'
import { pickContextualTutorReply } from './tutor-reply-engine'
import { speakTutorTextWithSpokenProgress } from './tutor-speech-playback'
import { awaitWithTimeout } from './await-with-timeout'

export function useHomePracticeTurn(deps: HomeUtterancePipelineDeps) {
  const {
    inferenceClientRef,
    inferenceInFlightFlagsRef,
    speechPlaybackGenerationRef,
    speechPlaybackAbortControllerRef,
    pendingSpokenProgressRef,
    pronunciationAttemptGenerationRef,
    practiceRepositoryRef,
    activeSessionIdRef,
    userTurnIndexRef,
    selectedScenarioIdRef,
    chatMessagesRef,
    transcriptionAttemptGenerationRef,
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
    setCommunicationSuggestions,
    createInferenceClient,
  } = deps

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
  }, [practiceRepositoryRef, setPracticeHistoryStatusMessage, setPracticeHistoryTurns])

  const persistPendingSpokenProgress = useCallback(
    async (progress: SpokenProgress | null) => {
      pendingSpokenProgressRef.current = progress
      const repository = practiceRepositoryRef.current
      const sessionId = activeSessionIdRef.current
      if (!repository || !sessionId) {
        return
      }
      try {
        await repository.setPendingSpokenProgress(sessionId, progress)
      } catch (error) {
        console.warn('Failed to persist pending spoken progress.', error)
      }
    },
    [activeSessionIdRef, pendingSpokenProgressRef, practiceRepositoryRef],
  )

  const speakTutorText = useCallback(
    async (englishText: string): Promise<SpokenProgress> => {
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
        createInferenceClient,
      )
      return speakTutorTextWithSpokenProgress(englishText, {
        inferenceClient,
        speechPlaybackGenerationRef,
        speechPlaybackAbortControllerRef,
        setSpeechSynthesisStatus,
        setSpeechModelLoadingProgressPercent,
        setSpeechSynthesisErrorReason,
        markSpeechSynthesisInFlight: (inFlight) => {
          inferenceInFlightFlagsRef.current.speechSynthesis = inFlight
        },
        persistPendingSpokenProgress,
      })
    },
    [
      createInferenceClient,
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      persistPendingSpokenProgress,
      setGrammarCorrectionStatus,
      setGrammarModelLoadingProgressPercent,
      setModelLoadingProgressPercent,
      setSpeechModelLoadingProgressPercent,
      setSpeechSynthesisErrorReason,
      setSpeechSynthesisStatus,
      setTranscriptionStatus,
      setTutorGenerationStatus,
      setTutorModelLoadingProgressPercent,
      speechPlaybackAbortControllerRef,
      speechPlaybackGenerationRef,
    ],
  )

  const scoreUserPronunciation = useCallback(
    async (
      referenceEnglishText: string,
      turnSignalSnapshot: UserTurnSignalSnapshot | null,
      transcribedText: string = referenceEnglishText,
    ): Promise<PronunciationScoreResult | null> => {
      const eligibility = resolvePronunciationScoreEligibilityFromCapture({
        samples: turnSignalSnapshot?.samples,
        sampleRateInHertz: turnSignalSnapshot?.sampleRateInHertz ?? 0,
        transcribedText,
        referenceEnglishText,
      })
      if (!eligibility.shouldScore || !turnSignalSnapshot || !inferenceClientRef.current) {
        setPronunciationStatus(
          resolveConversationPronunciationSkipStatus(eligibility),
        )
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
          synthesizeSpeech: (text) =>
            awaitWithTimeout(
              inferenceClient.synthesizeSpeech(text),
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
    [
      inferenceClientRef,
      pronunciationAttemptGenerationRef,
      setPronunciationScore,
      setPronunciationStatus,
    ],
  )

  const persistPracticeTurn = useCallback(
    async (input: {
      transcribedText: string
      correctedText: string
      tutorReplyText: string
      tutorUsedFallback: boolean
      pronunciation: PronunciationScoreResult | null
      formants: FormantTriple | null
      spokenProgress: SpokenProgress | null
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
          spokenProgress: input.spokenProgress as StoredSpokenProgress | null,
        })
        await refreshPracticeHistory()
      } catch (error) {
        console.warn('Failed to persist practice turn.', error)
        setPracticeHistoryStatusMessage(homeScreenInterfaceTexts.practiceHistory.statusError)
      }
    },
    [
      activeSessionIdRef,
      practiceRepositoryRef,
      refreshPracticeHistory,
      selectedScenarioIdRef,
      setPracticeHistoryStatusMessage,
    ],
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
      const intentPhrase = pickBestIntentPhrase(transcribedTextResult, correctedText)
      const pendingSpoken = pendingSpokenProgressRef.current

      // Issue #46: classify barge-in against spoken_text only; deterministic bridges.
      const interruptionResolution =
        pendingSpoken && !pendingSpoken.completed
          ? resolvePostInterruptionTutorReply({
              scenario,
              spokenProgress: pendingSpoken,
              userUtteranceEn: intentPhrase,
              userTurnIndex: turnIndex,
            })
          : null

      if (!interruptionResolution || interruptionResolution.advanceScene) {
        userTurnIndexRef.current = turnIndex + 1
      }

      const fallbackReplyText = interruptionResolution
        ? interruptionResolution.replyText
        : pickContextualTutorReply({
            scenario,
            userUtteranceEn: intentPhrase,
            userTurnIndex: turnIndex,
          })

      const historyTurnsEn = buildRecentHistoryTurnsEn(chatMessagesRef.current)
      const communicationSuggestions = buildCommunicationSuggestions({
        scenarioId: selectedScenarioIdRef.current,
        userUtteranceEn: transcribedTextResult,
        correctedUtteranceEn: referencePhrase,
        userTurnIndex: turnIndex,
      })
      setCommunicationSuggestions(communicationSuggestions)
      const scenarioContextEn = interruptionResolution?.llmContextNoteEn
        ? `${scenario.generationContextEn}\n\n${interruptionResolution.llmContextNoteEn}`
        : scenario.generationContextEn

      const startedAtGeneration = transcriptionAttemptGenerationRef.current
      const tutorOutcome = await publishUserUtteranceThenResolveTutor({
        publishUserUtterance: () => {
          setChatMessages((currentMessages) => [...currentMessages, userMessage])
          setTutorGenerationStatus('generating')
        },
        resolveTutorReply: () =>
          resolvePracticeTutorReply({
            generateTutorReply: inferenceClientRef.current?.generateTutorReply,
            markTutorGenerationInFlight: (inFlight) => {
              inferenceInFlightFlagsRef.current.tutorGeneration = inFlight
            },
            scenarioContextEn,
            historyTurnsEn,
            userUtteranceEn: intentPhrase,
            fallbackReplyEn: fallbackReplyText,
            interruptionResolution,
          }),
        startedAtGeneration,
        readCurrentGeneration: () => transcriptionAttemptGenerationRef.current,
      })

      if (!tutorOutcome.applied) {
        return
      }

      const { tutorReplyText, usedFallback } = tutorOutcome.result
      setChatMessages((currentMessages) => [
        ...currentMessages,
        createTutorReplyMessage(tutorReplyText, nextChatMessageId('tutor'), usedFallback),
      ])
      setTutorGenerationStatus(tutorGenerationStatusFromResult(usedFallback))

      if (interruptionResolution?.clearPendingCutoff) {
        await persistPendingSpokenProgress(null)
      }

      const pronunciation = await scoreUserPronunciation(
        referencePhrase,
        turnSignalSnapshot,
        transcribedTextResult,
      )
      const spokenProgress = await speakTutorText(tutorReplyText)
      await persistPracticeTurn({
        transcribedText: transcribedTextResult,
        correctedText: referencePhrase,
        tutorReplyText,
        tutorUsedFallback: usedFallback,
        pronunciation,
        formants: turnSignalSnapshot.formants,
        spokenProgress,
      })
    },
    [
      chatMessagesRef,
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      pendingSpokenProgressRef,
      persistPendingSpokenProgress,
      persistPracticeTurn,
      scoreUserPronunciation,
      selectedScenarioIdRef,
      setChatMessages,
      setCommunicationSuggestions,
      setTutorGenerationStatus,
      speakTutorText,
      transcriptionAttemptGenerationRef,
      userTurnIndexRef,
    ],
  )

  return { appendSuccessfulPracticeTurn, refreshPracticeHistory }
}
