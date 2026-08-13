/**
 * Drill mode: repeat the tutor's last line and get scored against it.
 * Fully isolated from the normal conversation pipeline — reuses the same
 * safe microphone capture and pronunciation-scoring building blocks, but
 * never advances the scenario script and never touches chat state.
 */

import { useCallback, useRef, useState } from 'react'
import { startMicrophoneCapture, type MicrophoneCaptureSession } from '../audio/microphone-capture'
import type { InferenceClient } from '../ia/inference-client'
import type { DrillUiStatus } from './home-screen-status'
import { runPronunciationScoringForUtterance } from './run-pronunciation-scoring'
import { resolveDrillReferenceText } from './drill-reference-text'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'

export interface UseDrillRepetitionOptions {
  readonly getInferenceClient: () => InferenceClient | null
  readonly getLastTutorLineEn: () => string
}

export interface UseDrillRepetitionResult {
  readonly drillStatus: DrillUiStatus
  readonly drillScore: PronunciationScoreResult | null
  readonly isDrillListening: boolean
  readonly startDrillRecording: () => Promise<void>
  readonly stopDrillRecording: () => void
}

export function useDrillRepetition(
  options: UseDrillRepetitionOptions,
): UseDrillRepetitionResult {
  const [drillStatus, setDrillStatus] = useState<DrillUiStatus>('idle')
  const [drillScore, setDrillScore] = useState<PronunciationScoreResult | null>(null)
  const [isDrillListening, setIsDrillListening] = useState(false)
  const captureSessionRef = useRef<MicrophoneCaptureSession | null>(null)
  const attemptGenerationRef = useRef(0)

  const startDrillRecording = useCallback(async () => {
    const { isAvailable } = resolveDrillReferenceText(options.getLastTutorLineEn())
    if (!isAvailable) {
      setDrillStatus('unavailable')
      return
    }

    const attemptGeneration = (attemptGenerationRef.current += 1)
    setDrillScore(null)
    setDrillStatus('listening')

    try {
      const captureSession = await startMicrophoneCapture()
      if (attemptGeneration !== attemptGenerationRef.current) {
        captureSession.abort()
        return
      }
      captureSessionRef.current = captureSession
      setIsDrillListening(true)
    } catch {
      if (attemptGeneration === attemptGenerationRef.current) {
        setDrillStatus('unavailable')
      }
    }
  }, [options])

  const stopDrillRecording = useCallback(() => {
    const session = captureSessionRef.current
    captureSessionRef.current = null
    setIsDrillListening(false)

    if (!session) {
      return
    }

    const attemptGeneration = attemptGenerationRef.current
    setDrillStatus('scoring')

    void (async () => {
      try {
        const capturedAudio = await session.stop()
        const inferenceClient = options.getInferenceClient()
        const { isAvailable, referenceTextEn } = resolveDrillReferenceText(
          options.getLastTutorLineEn(),
        )

        if (
          attemptGeneration !== attemptGenerationRef.current ||
          !inferenceClient ||
          !isAvailable ||
          capturedAudio.samples.length === 0
        ) {
          if (attemptGeneration === attemptGenerationRef.current) {
            setDrillStatus('unavailable')
          }
          return
        }

        const result = await runPronunciationScoringForUtterance({
          userSamples: capturedAudio.samples,
          userSampleRateInHertz: capturedAudio.sampleRate,
          referenceEnglishText: referenceTextEn,
          synthesizeSpeech: inferenceClient.synthesizeSpeech,
        })

        if (attemptGeneration !== attemptGenerationRef.current) {
          return
        }

        if (!result) {
          setDrillStatus('unavailable')
          setDrillScore(null)
          return
        }

        setDrillScore(result)
        setDrillStatus('done')
      } catch {
        if (attemptGeneration === attemptGenerationRef.current) {
          setDrillStatus('unavailable')
          setDrillScore(null)
        }
      }
    })()
  }, [options])

  return {
    drillStatus,
    drillScore,
    isDrillListening,
    startDrillRecording,
    stopDrillRecording,
  }
}
