/**
 * Shared InferenceClient wiring for the home-screen session (progress → UI status).
 */

import type { Dispatch, SetStateAction } from 'react'
import { createInferenceClient } from '../ia/inference-client'
import type { InferenceClient } from '../ia/inference-client'
import type {
  GrammarCorrectionUiStatus,
  SpeechSynthesisUiStatus,
  TranscriptionUiStatus,
} from './home-screen-status'

export type InferenceInFlightFlags = {
  transcription: boolean
  grammarCorrection: boolean
  speechSynthesis: boolean
  tutorGeneration: boolean
}

export type TutorGenerationUiStatus =
  | 'idle'
  | 'loading-model'
  | 'generating'
  | 'done-generated'
  | 'done-fallback'
  | 'error'

/**
 * Only show "loading-model" while download is incomplete.
 * Avoids sticky "Preparando… 100%" after preload (progress can fire at 100% after ready).
 */
function applyModelProgress(
  progressPercent: number,
  isInFlight: boolean,
  setStatusLoading: () => void,
  setStatusIdleOrActive: () => void,
  setProgress: (percent: number) => void,
): void {
  setProgress(progressPercent)
  if (progressPercent < 100) {
    setStatusLoading()
    return
  }
  if (!isInFlight) {
    setStatusIdleOrActive()
  }
}

export function ensureHomeInferenceClient(
  inferenceClientRef: { current: InferenceClient | null },
  inFlightFlagsRef: { current: InferenceInFlightFlags },
  setTranscriptionStatus: Dispatch<SetStateAction<TranscriptionUiStatus>>,
  setModelLoadingProgressPercent: Dispatch<SetStateAction<number>>,
  setGrammarCorrectionStatus: Dispatch<SetStateAction<GrammarCorrectionUiStatus>>,
  setGrammarModelLoadingProgressPercent: Dispatch<SetStateAction<number>>,
  setSpeechSynthesisStatus: Dispatch<SetStateAction<SpeechSynthesisUiStatus>>,
  setSpeechModelLoadingProgressPercent: Dispatch<SetStateAction<number>>,
  setTutorGenerationStatus: Dispatch<SetStateAction<TutorGenerationUiStatus>>,
  setTutorModelLoadingProgressPercent: Dispatch<SetStateAction<number>>,
): InferenceClient {
  if (inferenceClientRef.current) {
    return inferenceClientRef.current
  }

  const inferenceClient = createInferenceClient()
  inferenceClient.subscribeToModelLoadingProgress((progressMessage) => {
    if (progressMessage.modelKey === 'automaticSpeechRecognition') {
      applyModelProgress(
        progressMessage.progressPercent,
        inFlightFlagsRef.current.transcription,
        () => setTranscriptionStatus('loading-model'),
        () =>
          setTranscriptionStatus((current) =>
            current === 'loading-model' ? 'idle' : current,
          ),
        setModelLoadingProgressPercent,
      )
    } else if (progressMessage.modelKey === 'grammarCorrection') {
      applyModelProgress(
        progressMessage.progressPercent,
        inFlightFlagsRef.current.grammarCorrection,
        () => setGrammarCorrectionStatus('loading-model'),
        () =>
          setGrammarCorrectionStatus((current) =>
            current === 'loading-model' ? 'idle' : current,
          ),
        setGrammarModelLoadingProgressPercent,
      )
    } else if (progressMessage.modelKey === 'textToSpeech') {
      applyModelProgress(
        progressMessage.progressPercent,
        inFlightFlagsRef.current.speechSynthesis,
        () => setSpeechSynthesisStatus('loading-model'),
        () =>
          setSpeechSynthesisStatus((current) =>
            current === 'loading-model' ? 'idle' : current,
          ),
        setSpeechModelLoadingProgressPercent,
      )
    } else if (progressMessage.modelKey === 'conversationSuggestions') {
      applyModelProgress(
        progressMessage.progressPercent,
        inFlightFlagsRef.current.tutorGeneration,
        () => setTutorGenerationStatus('loading-model'),
        () =>
          setTutorGenerationStatus((current) =>
            current === 'loading-model' ? 'idle' : current,
          ),
        setTutorModelLoadingProgressPercent,
      )
    }
  })
  inferenceClient.subscribeToModelReady((readyMessage) => {
    if (readyMessage.modelKey === 'automaticSpeechRecognition') {
      setModelLoadingProgressPercent(100)
      setTranscriptionStatus((currentStatus) => {
        if (currentStatus !== 'loading-model' && currentStatus !== 'idle') {
          return currentStatus
        }
        return inFlightFlagsRef.current.transcription ? 'transcribing' : 'idle'
      })
    } else if (readyMessage.modelKey === 'grammarCorrection') {
      setGrammarModelLoadingProgressPercent(100)
      setGrammarCorrectionStatus((currentStatus) => {
        if (currentStatus !== 'loading-model' && currentStatus !== 'idle') {
          return currentStatus
        }
        return inFlightFlagsRef.current.grammarCorrection
          ? 'correcting-grammar'
          : 'idle'
      })
    } else if (readyMessage.modelKey === 'textToSpeech') {
      setSpeechModelLoadingProgressPercent(100)
      setSpeechSynthesisStatus((currentStatus) => {
        if (currentStatus !== 'loading-model' && currentStatus !== 'idle') {
          return currentStatus
        }
        return inFlightFlagsRef.current.speechSynthesis ? 'synthesizing' : 'idle'
      })
    } else if (readyMessage.modelKey === 'conversationSuggestions') {
      setTutorModelLoadingProgressPercent(100)
      setTutorGenerationStatus((currentStatus) => {
        if (currentStatus !== 'loading-model' && currentStatus !== 'idle') {
          return currentStatus
        }
        return inFlightFlagsRef.current.tutorGeneration ? 'generating' : 'idle'
      })
    }
  })
  inferenceClientRef.current = inferenceClient
  return inferenceClient
}
