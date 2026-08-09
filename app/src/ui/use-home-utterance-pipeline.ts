/**
 * Composes practice-turn + transcription pipeline hooks.
 */

import type { HomeUtterancePipelineDeps } from './home-utterance-pipeline-deps'
import { useHomePracticeTurn } from './use-home-practice-turn'
import { useHomeTranscriptionPipeline } from './use-home-transcription-pipeline'

export type { HomeUtterancePipelineDeps } from './home-utterance-pipeline-deps'

export function useHomeUtterancePipeline(deps: HomeUtterancePipelineDeps) {
  const { appendSuccessfulPracticeTurn, refreshPracticeHistory } = useHomePracticeTurn(deps)
  const { transcribeCapturedAudio } = useHomeTranscriptionPipeline(
    deps,
    appendSuccessfulPracticeTurn,
  )

  return {
    refreshPracticeHistory,
    transcribeCapturedAudio,
  }
}
