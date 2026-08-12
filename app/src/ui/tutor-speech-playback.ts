/**
 * Tutor TTS playback with AbortSignal + spoken_progress (issue #46).
 * Extracted from the practice-turn hook so the hook stays under the line budget.
 */

import { playMonoPcmSamples } from '../audio/play-pcm-mono'
import type { InferenceClient, InferenceClientErrorReason } from '../ia/inference-client'
import { InferenceClientError } from '../ia/inference-client'
import { createStorageId } from '../storage/practice-session-types'
import { awaitWithTimeout } from './await-with-timeout'
import type { SpeechSynthesisUiStatus } from './home-screen-status'
import { SPEECH_SYNTHESIS_TIMEOUT_MS } from './home-session-helpers'
import { buildSpokenProgress, type SpokenProgress } from './spoken-progress'

export interface SpeakTutorTextDeps {
  readonly inferenceClient: InferenceClient
  readonly speechPlaybackGenerationRef: { current: number }
  readonly speechPlaybackAbortControllerRef: { current: AbortController | null }
  readonly setSpeechSynthesisStatus: (status: SpeechSynthesisUiStatus) => void
  readonly setSpeechModelLoadingProgressPercent: (value: number) => void
  readonly setSpeechSynthesisErrorReason: (reason: InferenceClientErrorReason | null) => void
  readonly markSpeechSynthesisInFlight: (inFlight: boolean) => void
  readonly persistPendingSpokenProgress: (progress: SpokenProgress | null) => Promise<void>
}

/**
 * Synthesize and play tutor English; returns spoken_progress for the utterance.
 * Abort via `speechPlaybackAbortControllerRef` (user barge-in) reports partial cutoff.
 */
export async function speakTutorTextWithSpokenProgress(
  englishText: string,
  deps: SpeakTutorTextDeps,
): Promise<SpokenProgress> {
  const utteranceId = createStorageId('utt')
  const fullText = englishText.trim()
  const completedProgress = buildSpokenProgress({
    utteranceId,
    fullText,
    cutoffMs: 0,
    completed: true,
  })

  const playbackGeneration = (deps.speechPlaybackGenerationRef.current += 1)
  const abortController = new AbortController()
  deps.speechPlaybackAbortControllerRef.current = abortController
  deps.markSpeechSynthesisInFlight(true)
  deps.setSpeechSynthesisStatus('synthesizing')
  deps.setSpeechSynthesisErrorReason(null)
  deps.setSpeechModelLoadingProgressPercent(0)

  try {
    const synthesized = await awaitWithTimeout(
      deps.inferenceClient.synthesizeSpeech(englishText),
      SPEECH_SYNTHESIS_TIMEOUT_MS,
      new Error('Tutor speech synthesis timed out.'),
    )
    if (playbackGeneration !== deps.speechPlaybackGenerationRef.current) {
      const aborted = buildSpokenProgress({
        utteranceId,
        fullText,
        cutoffMs: 0,
        completed: false,
      })
      await deps.persistPendingSpokenProgress(aborted)
      return aborted
    }
    deps.setSpeechSynthesisStatus('playing')
    const totalDurationMs =
      synthesized.sampleRateInHertz > 0
        ? (synthesized.samples.length / synthesized.sampleRateInHertz) * 1000
        : undefined
    const playback = await awaitWithTimeout(
      playMonoPcmSamples(synthesized.samples, synthesized.sampleRateInHertz, {
        signal: abortController.signal,
      }),
      SPEECH_SYNTHESIS_TIMEOUT_MS,
      new Error('Tutor speech playback timed out.'),
    )
    if (playbackGeneration !== deps.speechPlaybackGenerationRef.current) {
      const progress = buildSpokenProgress({
        utteranceId,
        fullText,
        cutoffMs: playback.cutoffMs,
        totalDurationMs,
        completed: false,
      })
      await deps.persistPendingSpokenProgress(progress)
      return progress
    }

    const progress = buildSpokenProgress({
      utteranceId,
      fullText,
      cutoffMs: playback.cutoffMs,
      totalDurationMs,
      completed: playback.completed,
    })
    await deps.persistPendingSpokenProgress(progress.completed ? null : progress)
    deps.setSpeechSynthesisStatus('done')
    return progress
  } catch (error) {
    if (playbackGeneration !== deps.speechPlaybackGenerationRef.current) {
      const aborted = buildSpokenProgress({
        utteranceId,
        fullText,
        cutoffMs: 0,
        completed: false,
      })
      await deps.persistPendingSpokenProgress(aborted)
      return aborted
    }
    const reason = error instanceof InferenceClientError ? error.reason : 'worker-unavailable'
    deps.setSpeechSynthesisErrorReason(reason)
    deps.setSpeechSynthesisStatus('error')
    console.error(error)
    return completedProgress
  } finally {
    if (deps.speechPlaybackAbortControllerRef.current === abortController) {
      deps.speechPlaybackAbortControllerRef.current = null
    }
    if (playbackGeneration === deps.speechPlaybackGenerationRef.current) {
      deps.markSpeechSynthesisInFlight(false)
    }
  }
}
