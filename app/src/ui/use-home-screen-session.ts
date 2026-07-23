/**
 * Home-screen session orchestration: mic capture, waveform, ASR → grammar.
 * Keeps React state here; presentation lives in `HomeScreen.tsx`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { MicrophoneCaptureError, startMicrophoneCapture } from '../audio/microphone-capture'
import type { CaptureDiagnostics, MicrophoneCaptureSession } from '../audio/microphone-capture'
import { isGetUserMediaNative } from '../audio/open-microphone-stream'
import { homeScreenInterfaceTexts } from './interface-texts'
import { resampleToWhisperRate } from '../audio/audio-resampler'
import { hasUsableSpeechEnergy } from '../dsp/signal-energy'
import { createInferenceClient, InferenceClientError } from '../ia/inference-client'
import type { InferenceClient, InferenceClientErrorReason } from '../ia/inference-client'
import { grammarCorrectionMadeNoChanges } from '../ia/grammar-correction'
import { isDegenerateTranscript, isNonSpeechTranscript } from '../ia/transcription-text'
import {
  captureDiagnosticsMessageFor,
  grammarCorrectionStatusMessageFor,
  microphoneStatusMessageFor,
  transcriptionStatusMessageFor,
} from './home-screen-status'
import type {
  GrammarCorrectionUiStatus,
  MicrophoneUiStatus,
  NoAudioReason,
  TranscriptionUiStatus,
} from './home-screen-status'
import { clearWaveformCanvas, startAnalyserWaveformAnimation } from './waveform-canvas'
import type { HomeScreenProps } from './HomeScreen'

/** Flags so model-ready after preload goes to idle, not "transcribing". */
type InferenceInFlightFlags = {
  transcription: boolean
  grammarCorrection: boolean
}

function ensureInferenceClient(
  inferenceClientRef: { current: InferenceClient | null },
  inFlightFlagsRef: { current: InferenceInFlightFlags },
  setTranscriptionStatus: Dispatch<SetStateAction<TranscriptionUiStatus>>,
  setModelLoadingProgressPercent: Dispatch<SetStateAction<number>>,
  setGrammarCorrectionStatus: Dispatch<SetStateAction<GrammarCorrectionUiStatus>>,
  setGrammarModelLoadingProgressPercent: Dispatch<SetStateAction<number>>,
): InferenceClient {
  if (inferenceClientRef.current) {
    return inferenceClientRef.current
  }

  const inferenceClient = createInferenceClient()
  inferenceClient.subscribeToModelLoadingProgress((progressMessage) => {
    if (progressMessage.modelKey === 'automaticSpeechRecognition') {
      setTranscriptionStatus('loading-model')
      setModelLoadingProgressPercent(progressMessage.progressPercent)
    } else if (progressMessage.modelKey === 'grammarCorrection') {
      setGrammarCorrectionStatus('loading-model')
      setGrammarModelLoadingProgressPercent(progressMessage.progressPercent)
    }
  })
  inferenceClient.subscribeToModelReady((readyMessage) => {
    if (readyMessage.modelKey === 'automaticSpeechRecognition') {
      setModelLoadingProgressPercent(100)
      setTranscriptionStatus((currentStatus) => {
        if (currentStatus !== 'loading-model') {
          return currentStatus
        }
        // Active stop→ASR path vs warm preload while idle.
        return inFlightFlagsRef.current.transcription ? 'transcribing' : 'idle'
      })
    } else if (readyMessage.modelKey === 'grammarCorrection') {
      setGrammarModelLoadingProgressPercent(100)
      setGrammarCorrectionStatus((currentStatus) => {
        if (currentStatus !== 'loading-model') {
          return currentStatus
        }
        return inFlightFlagsRef.current.grammarCorrection
          ? 'correcting-grammar'
          : 'idle'
      })
    }
  })
  inferenceClientRef.current = inferenceClient
  return inferenceClient
}

export function useHomeScreenSession(): HomeScreenProps {
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
  const [liveInputLevel01, setLiveInputLevel01] = useState(0)
  const [liveRms, setLiveRms] = useState(0)
  const [livePeak, setLivePeak] = useState(0)
  const [activeMicrophoneLabel, setActiveMicrophoneLabel] = useState('')
  const [microphoneErrorDetail, setMicrophoneErrorDetail] = useState<string | null>(null)
  const [environmentDiagnosticsMessage, setEnvironmentDiagnosticsMessage] = useState<string | null>(
    null,
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureSessionRef = useRef<MicrophoneCaptureSession | null>(null)
  const stopWaveformAnimationRef = useRef<(() => void) | null>(null)
  const inferenceClientRef = useRef<InferenceClient | null>(null)
  const inferenceInFlightFlagsRef = useRef<InferenceInFlightFlags>({
    transcription: false,
    grammarCorrection: false,
  })
  const captureAttemptGenerationRef = useRef(0)
  const transcriptionAttemptGenerationRef = useRef(0)

  const isStarting = microphoneStatus === 'starting'
  const isListening = microphoneStatus === 'listening'

  /**
   * Tear down an active session only. Do not bump capture generation here:
   * bumping on every React StrictMode/HMR cleanup was discarding a still-valid
   * in-flight startMicrophoneCapture() and left the UI “deaf” or stuck.
   * Generation is only advanced on intentional start/stop.
   */
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
    [],
  )

  const transcribeCapturedAudio = useCallback(
    async (samples: Float32Array, nativeSampleRate: number, diagnostics: CaptureDiagnostics) => {
      setCaptureDiagnostics(diagnostics)

      if (samples.length === 0) {
        setTranscriptionStatus('no-audio')
        setNoAudioReason({ kind: 'empty-recording' })
        setTranscribedText('')
        setTranscriptionErrorReason(null)
        setGrammarCorrectionStatus('idle')
        setCorrectedGrammarText('')
        setGrammarCorrectionErrorReason(null)
        return
      }

      // Gate on native-rate capture (before resample) so duration/RMS match reality.
      if (!hasUsableSpeechEnergy(samples, nativeSampleRate)) {
        setTranscriptionStatus('no-audio')
        setNoAudioReason({ kind: 'low-energy', diagnostics })
        setTranscribedText('')
        setTranscriptionErrorReason(null)
        setGrammarCorrectionStatus('idle')
        setCorrectedGrammarText('')
        setGrammarCorrectionErrorReason(null)
        return
      }

      const samples16kHz = resampleToWhisperRate(samples, nativeSampleRate)

      const inferenceClient = ensureInferenceClient(
        inferenceClientRef,
        inferenceInFlightFlagsRef,
        setTranscriptionStatus,
        setModelLoadingProgressPercent,
        setGrammarCorrectionStatus,
        setGrammarModelLoadingProgressPercent,
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
          return
        }

        if (isDegenerateTranscript(transcribedTextResult, audioDurationSeconds)) {
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
          return
        }

        setTranscribedText(transcribedTextResult)
        setTranscriptionStatus('done')
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
    [correctTranscribedGrammar],
  )

  const handleStartButtonClick = useCallback(async () => {
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

      // Session arrived after a newer start/stop: drop it and never stay on "starting".
      if (attemptGeneration !== captureAttemptGenerationRef.current) {
        captureSession.abort()
        setMicrophoneStatus((status) => (status === 'starting' ? 'idle' : status))
        return
      }

      captureSessionRef.current = captureSession
      setActiveMicrophoneLabel(captureSession.deviceLabel)
      setMicrophoneStatus('listening')

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

  // Warm-load Whisper + T5 as soon as the home screen mounts so the first
  // stop pays inference time (~goal <2s), not the multi-file Hub download.
  useEffect(() => {
    const inferenceClient = ensureInferenceClient(
      inferenceClientRef,
      inferenceInFlightFlagsRef,
      setTranscriptionStatus,
      setModelLoadingProgressPercent,
      setGrammarCorrectionStatus,
      setGrammarModelLoadingProgressPercent,
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

  // Environment banner: detect Playwright/test mocks of getUserMedia.
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
  )
  const grammarCorrectionStatusMessage = grammarCorrectionStatusMessageFor(
    grammarCorrectionStatus,
    grammarModelLoadingProgressPercent,
    grammarCorrectionErrorReason,
  )
  const grammarCorrectionMadeNoChangesToTranscription =
    grammarCorrectionStatus === 'done' &&
    grammarCorrectionMadeNoChanges(transcribedText, correctedGrammarText)

  const captureDiagnosticsMessage =
    captureDiagnostics && transcriptionStatus === 'no-audio'
      ? captureDiagnosticsMessageFor(captureDiagnostics)
      : null

  return {
    canvasRef,
    isStarting,
    isListening,
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
    onStartMicrophone: () => {
      void handleStartButtonClick()
    },
    onStopMicrophone: handleStopButtonClick,
  }
}
