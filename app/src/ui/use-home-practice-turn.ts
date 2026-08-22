/** Tutor reply, instant voice, score, and IndexedDB persist for one turn. */

import { useCallback } from 'react'
import { buildCommunicationSuggestions } from '../ia/communication-suggestions'
import { startDynamicSuggestionEnrichment } from './schedule-dynamic-suggestions'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
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
import { persistCompletedPracticeTurn } from './persist-practice-turn'
import { PRACTICE_HABIT_TURN_LIMIT } from './practice-habits'
import { pickContextualTutorReply } from './tutor-reply-engine'
import { speakTutorTextWithSpokenProgress } from './tutor-speech-playback'
import {
  attachUserTurnSignalCardToMessages,
  createUserTurnSignalCard,
} from './user-turn-signal-card'
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
      const turns = await repository.listRecentTurns(PRACTICE_HABIT_TURN_LIMIT)
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
      const lastTutorLineEn =
        [...chatMessagesRef.current].reverse().find((message) => message.role === 'tutor')?.text ??
        ''
      const communicationSuggestions = buildCommunicationSuggestions({
        scenarioId: selectedScenarioIdRef.current,
        userUtteranceEn: transcribedTextResult,
        correctedUtteranceEn: referencePhrase,
        userTurnIndex: turnIndex,
        lastTutorLineEn,
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

      startDynamicSuggestionEnrichment({
        generateCommunicationCoaching: inferenceClientRef.current?.generateCommunicationCoaching,
        structural: communicationSuggestions,
        scenarioContextEn,
        lastTutorLineEn,
        userUtteranceEn: transcribedTextResult,
        startedAtGeneration,
        readCurrentGeneration: () => transcriptionAttemptGenerationRef.current,
        setSuggestions: setCommunicationSuggestions,
      })

      if (interruptionResolution?.clearPendingCutoff) {
        await persistPendingSpokenProgress(null)
      }

      const pronunciation = await scoreUserPronunciation(
        referencePhrase,
        turnSignalSnapshot,
        transcribedTextResult,
      )
      const eligibility = resolvePronunciationScoreEligibilityFromCapture({
        samples: turnSignalSnapshot.samples,
        sampleRateInHertz: turnSignalSnapshot.sampleRateInHertz,
        transcribedText: transcribedTextResult,
        referenceEnglishText: referencePhrase,
      })
      setChatMessages((currentMessages) =>
        attachUserTurnSignalCardToMessages(
          currentMessages,
          userMessage.id,
          createUserTurnSignalCard({
            pronunciation,
            formants: turnSignalSnapshot.formants,
            skipReason: eligibility.shouldScore ? null : eligibility.reason,
          }),
        ),
      )
      const spokenProgress = await speakTutorText(tutorReplyText)
      await persistCompletedPracticeTurn({
        repository: practiceRepositoryRef.current,
        sessionId: activeSessionIdRef.current,
        scenarioId: selectedScenarioIdRef.current,
        transcribedText: transcribedTextResult,
        correctedText: referencePhrase,
        tutorReplyText,
        tutorUsedFallback: usedFallback,
        pronunciation,
        formants: turnSignalSnapshot.formants,
        spokenProgress,
        onHistoryReload: refreshPracticeHistory,
        onPersistError: () =>
          setPracticeHistoryStatusMessage(homeScreenInterfaceTexts.practiceHistory.statusError),
      })
    },
    [
      activeSessionIdRef,
      chatMessagesRef,
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      pendingSpokenProgressRef,
      persistPendingSpokenProgress,
      practiceRepositoryRef,
      refreshPracticeHistory,
      scoreUserPronunciation,
      selectedScenarioIdRef,
      setChatMessages,
      setCommunicationSuggestions,
      setPracticeHistoryStatusMessage,
      setTutorGenerationStatus,
      speakTutorText,
      transcriptionAttemptGenerationRef,
      userTurnIndexRef,
    ],
  )

  return { appendSuccessfulPracticeTurn, refreshPracticeHistory }
}
