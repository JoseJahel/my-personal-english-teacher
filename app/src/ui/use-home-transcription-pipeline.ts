/**
 * Usable capture → signal views → Whisper → grammar → practice turn.
 */

import { useCallback } from 'react'
import { resampleToWhisperRate } from '../audio/audio-resampler'
import { hasUsableSpeechEnergy } from '../dsp/signal-energy'
import { InferenceClientError } from '../ia/inference-client'
import { isDegenerateTranscript, isNonSpeechTranscript } from '../ia/transcription-text'
import type { CaptureDiagnostics } from '../audio/microphone-capture'
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
  } = deps

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
    [
      appendSuccessfulPracticeTurn,
      inferenceClientRef,
      inferenceInFlightFlagsRef,
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
    [
      correctTranscribedGrammar,
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
