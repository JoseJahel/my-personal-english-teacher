/**
 * Microphone start/stop with live waveform meters and energy VAD auto-stop.
 */

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import {
  MicrophoneCaptureError,
  startMicrophoneCapture,
  type CaptureDiagnostics,
  type MicrophoneCaptureSession,
} from '../audio/microphone-capture'
import { createEnergyVoiceActivityDetector } from '../dsp/voice-activity-detection'
import type { InferenceClientErrorReason } from '../ia/inference-client'
import { InferenceClientError } from '../ia/inference-client'
import type {
  GrammarCorrectionUiStatus,
  MicrophoneUiStatus,
  NoAudioReason,
  TranscriptionUiStatus,
} from './home-screen-status'
import type { InferenceInFlightFlags } from './home-inference-client'
import { clearWaveformCanvas, startAnalyserWaveformAnimation } from './waveform-canvas'

export interface HomeMicrophoneSessionDeps {
  readonly canvasRef: MutableRefObject<HTMLCanvasElement | null>
  readonly speechPlaybackGenerationRef: MutableRefObject<number>
  readonly inferenceInFlightFlagsRef: MutableRefObject<InferenceInFlightFlags>
  readonly setSpeechSynthesisStatusIdle: () => void
  readonly setMicrophoneStatus: Dispatch<SetStateAction<MicrophoneUiStatus>>
  readonly setTranscriptionStatus: Dispatch<SetStateAction<TranscriptionUiStatus>>
  readonly setTranscribedText: Dispatch<SetStateAction<string>>
  readonly setTranscriptionErrorReason: Dispatch<
    SetStateAction<InferenceClientErrorReason | null>
  >
  readonly setNoAudioReason: Dispatch<SetStateAction<NoAudioReason | null>>
  readonly setCaptureDiagnostics: Dispatch<SetStateAction<CaptureDiagnostics | null>>
  readonly setModelLoadingProgressPercent: Dispatch<SetStateAction<number>>
  readonly setGrammarCorrectionStatus: Dispatch<SetStateAction<GrammarCorrectionUiStatus>>
  readonly setCorrectedGrammarText: Dispatch<SetStateAction<string>>
  readonly setGrammarCorrectionErrorReason: Dispatch<
    SetStateAction<InferenceClientErrorReason | null>
  >
  readonly setGrammarModelLoadingProgressPercent: Dispatch<SetStateAction<number>>
  readonly setLiveInputLevel01: Dispatch<SetStateAction<number>>
  readonly setLiveRms: Dispatch<SetStateAction<number>>
  readonly setLivePeak: Dispatch<SetStateAction<number>>
  readonly setActiveMicrophoneLabel: Dispatch<SetStateAction<string>>
  readonly setMicrophoneErrorDetail: Dispatch<SetStateAction<string | null>>
  readonly transcribeCapturedAudio: (
    samples: Float32Array,
    nativeSampleRate: number,
    diagnostics: CaptureDiagnostics,
  ) => Promise<void>
}

export function useHomeMicrophoneSession(deps: HomeMicrophoneSessionDeps) {
  const captureSessionRef = useRef<MicrophoneCaptureSession | null>(null)
  const stopWaveformAnimationRef = useRef<(() => void) | null>(null)
  const captureAttemptGenerationRef = useRef(0)
  const voiceActivityDetectorRef = useRef(createEnergyVoiceActivityDetector())
  const autoStopTriggeredRef = useRef(false)
  const handleStopButtonClickRef = useRef<() => void>(() => {})

  const {
    canvasRef,
    speechPlaybackGenerationRef,
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
  } = deps

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
  }, [
    setActiveMicrophoneLabel,
    setLiveInputLevel01,
    setLivePeak,
    setLiveRms,
    setMicrophoneErrorDetail,
  ])

  const handleStartButtonClick = useCallback(async () => {
    // Half-duplex: cancel in-flight tutor playback when the user starts speaking.
    speechPlaybackGenerationRef.current += 1
    inferenceInFlightFlagsRef.current.speechSynthesis = false
    setSpeechSynthesisStatusIdle()

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
  }, [
    canvasRef,
    inferenceInFlightFlagsRef,
    setActiveMicrophoneLabel,
    setCaptureDiagnostics,
    setCorrectedGrammarText,
    setGrammarCorrectionErrorReason,
    setGrammarCorrectionStatus,
    setGrammarModelLoadingProgressPercent,
    setLiveInputLevel01,
    setLivePeak,
    setLiveRms,
    setMicrophoneErrorDetail,
    setMicrophoneStatus,
    setModelLoadingProgressPercent,
    setNoAudioReason,
    setSpeechSynthesisStatusIdle,
    setTranscribedText,
    setTranscriptionErrorReason,
    setTranscriptionStatus,
    speechPlaybackGenerationRef,
  ])

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
  }, [
    canvasRef,
    setLiveInputLevel01,
    setLivePeak,
    setLiveRms,
    setMicrophoneStatus,
    setTranscriptionErrorReason,
    setTranscriptionStatus,
    transcribeCapturedAudio,
  ])

  useEffect(() => {
    handleStopButtonClickRef.current = handleStopButtonClick
  }, [handleStopButtonClick])

  useEffect(() => {
    return () => {
      abortMicrophoneCapture()
    }
  }, [abortMicrophoneCapture])

  return {
    handleStartButtonClick,
    handleStopButtonClick,
  }
}
