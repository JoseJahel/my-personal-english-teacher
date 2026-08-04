/**
 * Tutor reply, TTS, pronunciation score, and IndexedDB persist for one turn.
 */

import { useCallback } from 'react'
import { playMonoPcmSamples } from '../audio/play-pcm-mono'
import type { FormantTriple } from '../dsp/formant-estimation'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import { InferenceClientError } from '../ia/inference-client'
import { awaitWithTimeout } from './await-with-timeout'
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
import { runPronunciationScoringForUtterance } from './run-pronunciation-scoring'
import { pickContextualTutorReply } from './tutor-reply-engine'
import { resolveTutorReplyWithFallback } from './tutor-reply-orchestration'

export function useHomePracticeTurn(deps: HomeUtterancePipelineDeps) {
  const {
    inferenceClientRef,
    inferenceInFlightFlagsRef,
    speechPlaybackGenerationRef,
    pronunciationAttemptGenerationRef,
    practiceRepositoryRef,
    activeSessionIdRef,
    userTurnIndexRef,
    selectedScenarioIdRef,
    chatMessagesRef,
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

  const speakTutorText = useCallback(
    async (englishText: string) => {
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
    },
    [
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      setGrammarCorrectionStatus,
      setGrammarModelLoadingProgressPercent,
      setModelLoadingProgressPercent,
      setSpeechModelLoadingProgressPercent,
      setSpeechSynthesisErrorReason,
      setSpeechSynthesisStatus,
      setTranscriptionStatus,
      setTutorGenerationStatus,
      setTutorModelLoadingProgressPercent,
      speechPlaybackGenerationRef,
    ],
  )

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
      userTurnIndexRef.current = turnIndex + 1
      const intentPhrase = pickBestIntentPhrase(transcribedTextResult, correctedText)
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
    [
      chatMessagesRef,
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      persistPracticeTurn,
      scoreUserPronunciation,
      selectedScenarioIdRef,
      setChatMessages,
      setTutorGenerationStatus,
      speakTutorText,
      userTurnIndexRef,
    ],
  )

  return { appendSuccessfulPracticeTurn, refreshPracticeHistory }
}
