/**
 * IndexedDB persist for one completed practice turn (metrics only, no PCM).
 */

import type { FormantTriple } from '../dsp/formant-estimation'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import type {
  StoredPracticeScenarioId,
  StoredSpokenProgress,
} from '../storage/practice-session-types'
import type { PracticeSessionRepository } from '../storage/session-repository'
import type { SpokenProgress } from './spoken-progress'

export async function persistCompletedPracticeTurn(input: {
  readonly repository: PracticeSessionRepository | null
  readonly sessionId: string | null
  readonly scenarioId: StoredPracticeScenarioId
  readonly transcribedText: string
  readonly correctedText: string
  readonly tutorReplyText: string
  readonly tutorUsedFallback: boolean
  readonly pronunciation: PronunciationScoreResult | null
  readonly formants: FormantTriple | null
  readonly spokenProgress: SpokenProgress | null
  readonly onHistoryReload: () => Promise<void>
  readonly onPersistError: () => void
}): Promise<void> {
  if (!input.repository || !input.sessionId) {
    return
  }
  try {
    await input.repository.saveTurn({
      sessionId: input.sessionId,
      scenarioId: input.scenarioId,
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
      spokenProgress: input.spokenProgress as StoredSpokenProgress | null,
    })
    await input.onHistoryReload()
  } catch (error) {
    console.warn('Failed to persist practice turn.', error)
    input.onPersistError()
  }
}
