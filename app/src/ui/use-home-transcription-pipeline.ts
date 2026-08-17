/**
 * Usable capture → signal views → Whisper → grammar → practice turn.
 */

import { useCallback } from 'react'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'
import { prepareUserSpeechPcmForAsr } from '../audio/prepare-user-asr-pcm'
import { hasUsableSpeechEnergy } from '../dsp/signal-energy'
import { InferenceClientError } from '../ia/inference-client'
import { isDegenerateTranscript, isNonSpeechTranscript } from '../ia/transcription-text'
import type { CaptureDiagnostics } from '../audio/microphone-capture'
import { applyGrammarCorrectionToLastUserMessage } from './apply-grammar-correction-to-messages'
import { ensureHomeInferenceClient } from './home-inference-client'
import type { HomeUtterancePipelineDeps } from './home-utterance-pipeline-deps'
import {
  createUserTurnSignalSnapshot,
  type UserTurnSignalSnapshot,
} from './practice-turn-signal-snapshot'
import {
  clearUtteranceSignalViews,
  updateUtteranceSignalViews,
} from './update-utterance-signal-views'

export function useHomeTranscriptionPipeline(
  deps: HomeUtterancePipelineDeps,
  appendSuccessfulPracticeTurn: (
    transcribedTextResult: string,
    correctedText: string,
    turnSignalSnapshot: UserTurnSignalSnapshot,
  ) => Promise<void>,
) {
  const {
    createInferenceClient,
    inferenceClientRef,
    inferenceInFlightFlagsRef,
    lastUserCaptureRef,
    pronunciationAttemptGenerationRef,
    transcriptionAttemptGenerationRef,
    medianFormantsRef,
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
    setPronunciationStatus,
    setPronunciationScore,
    setCaptureDiagnostics,
    setMedianFormants,
    setHasCompletedCapture,
    setNoAudioReason,
    setTranscribedText,
    setTranscriptionErrorReason,
    setCorrectedGrammarText,
    setGrammarCorrectionErrorReason,
    setChatMessages,
  } = deps

  const correctTranscribedGrammar = useCallback(
    async (transcribedTextResult: string, attemptGeneration: number) => {
      if (!transcribedTextResult.trim() || !inferenceClientRef.current) {
        setGrammarCorrectionStatus('idle')
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
        setChatMessages((current) =>
          applyGrammarCorrectionToLastUserMessage(
            current,
            transcribedTextResult,
            correctedText,
          ),
        )
      } catch (error) {
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }
        const reason = error instanceof InferenceClientError ? error.reason : 'worker-unavailable'
        setGrammarCorrectionErrorReason(reason)
        setGrammarCorrectionStatus('error')
        console.error(error)
      } finally {
        if (attemptGeneration === transcriptionAttemptGenerationRef.current) {
          inferenceInFlightFlagsRef.current.grammarCorrection = false
        }
      }
    },
    [
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      setChatMessages,
      setCorrectedGrammarText,
      setGrammarCorrectionErrorReason,
      setGrammarCorrectionStatus,
      transcriptionAttemptGenerationRef,
    ],
  )

  const resetAfterUnusableCapture = useCallback(() => {
    setTranscribedText('')
    setTranscriptionErrorReason(null)
    setGrammarCorrectionStatus('idle')
    setCorrectedGrammarText('')
    setGrammarCorrectionErrorReason(null)
    setPronunciationStatus('not-evaluated')
    setPronunciationScore(null)
  }, [
    setCorrectedGrammarText,
    setGrammarCorrectionErrorReason,
    setGrammarCorrectionStatus,
    setPronunciationScore,
    setPronunciationStatus,
    setTranscribedText,
    setTranscriptionErrorReason,
  ])

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
        resetAfterUnusableCapture()
        return
      }

      if (!hasUsableSpeechEnergy(samples, nativeSampleRate)) {
        lastUserCaptureRef.current = null
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
        resetAfterUnusableCapture()
        return
      }

      pronunciationAttemptGenerationRef.current += 1
      setHasCompletedCapture(true)

      const samples16kHz = prepareUserSpeechPcmForAsr(
        samples,
        nativeSampleRate,
        WHISPER_SAMPLE_RATE_IN_HERTZ,
      )
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

      const attemptGeneration = (transcriptionAttemptGenerationRef.current += 1)
      inferenceInFlightFlagsRef.current.transcription = true
      setTranscriptionStatus('transcribing')
      setNoAudioReason(null)
      setTranscriptionErrorReason(null)
      setGrammarCorrectionStatus('idle')
      setGrammarCorrectionErrorReason(null)
      setCorrectedGrammarText('')

      const transcriptionPromise = inferenceClient.transcribe(samples16kHz)

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

      try {
        const transcribedTextResult = await transcriptionPromise
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }

        const audioDurationSeconds = samples16kHz.length / WHISPER_SAMPLE_RATE_IN_HERTZ
        if (isNonSpeechTranscript(transcribedTextResult)) {
          lastUserCaptureRef.current = null
          setTranscriptionStatus('no-audio')
          setNoAudioReason({
            kind: 'non-speech',
            whisperRawText: transcribedTextResult || '(vacío)',
          })
          resetAfterUnusableCapture()
          return
        }

        if (isDegenerateTranscript(transcribedTextResult, audioDurationSeconds)) {
          lastUserCaptureRef.current = null
          setTranscriptionStatus('no-audio')
          setNoAudioReason({
            kind: 'degenerate',
            previewText: transcribedTextResult.slice(0, 80),
          })
          resetAfterUnusableCapture()
          return
        }

        setTranscribedText(transcribedTextResult)
        setTranscriptionStatus('done')
        void appendSuccessfulPracticeTurn(
          transcribedTextResult,
          transcribedTextResult,
          turnSignalSnapshot,
        )
        void correctTranscribedGrammar(transcribedTextResult, attemptGeneration)
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
    [
      appendSuccessfulPracticeTurn,
      correctTranscribedGrammar,
      createInferenceClient,
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      lastUserCaptureRef,
      medianFormantsRef,
      pitchTrackCanvasRef,
      pronunciationAttemptGenerationRef,
      resetAfterUnusableCapture,
      setCaptureDiagnostics,
      setCorrectedGrammarText,
      setGrammarCorrectionErrorReason,
      setGrammarCorrectionStatus,
      setGrammarModelLoadingProgressPercent,
      setHasCompletedCapture,
      setMedianFormants,
      setModelLoadingProgressPercent,
      setNoAudioReason,
      setSpeechModelLoadingProgressPercent,
      setSpeechSynthesisStatus,
      setTranscribedText,
      setTranscriptionErrorReason,
      setTranscriptionStatus,
      setTutorGenerationStatus,
      setTutorModelLoadingProgressPercent,
      spectrogramCanvasRef,
      transcriptionAttemptGenerationRef,
    ],
  )

  return { transcribeCapturedAudio }
}
