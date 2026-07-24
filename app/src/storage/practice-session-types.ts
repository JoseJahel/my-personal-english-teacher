/**
 * Serializable practice records for IndexedDB (no raw audio, ever).
 * Scenario ids mirror `ui/practice-scenarios` without importing UI (layer rule).
 */

/** Keep in sync with PracticeScenarioId in ui/practice-scenarios.ts */
export type StoredPracticeScenarioId = 'restaurant' | 'airport' | 'job-interview'

/** One practice session (scenario + time window). */
export interface PracticeSessionRecord {
  readonly id: string
  readonly createdAtIso: string
  readonly updatedAtIso: string
  readonly scenarioId: StoredPracticeScenarioId
}

/** One user turn after ASR/grammar/tutor/score — metrics only. */
export interface PracticeTurnRecord {
  readonly id: string
  readonly sessionId: string
  readonly createdAtIso: string
  readonly scenarioId: StoredPracticeScenarioId
  readonly transcribedText: string
  readonly correctedText: string
  readonly tutorReplyText: string
  readonly tutorUsedFallback: boolean
  readonly pronunciationScore0to100: number | null
  readonly mfccScore0to100: number | null
  readonly pitchScore0to100: number | null
  readonly formantF1InHertz: number | null
  readonly formantF2InHertz: number | null
  readonly formantF3InHertz: number | null
  readonly wordHighlightSummary: string
}

export interface CreatePracticeTurnInput {
  readonly sessionId: string
  readonly scenarioId: StoredPracticeScenarioId
  readonly transcribedText: string
  readonly correctedText: string
  readonly tutorReplyText: string
  readonly tutorUsedFallback: boolean
  readonly pronunciationScore0to100: number | null
  readonly mfccScore0to100: number | null
  readonly pitchScore0to100: number | null
  readonly formantF1InHertz: number | null
  readonly formantF2InHertz: number | null
  readonly formantF3InHertz: number | null
  readonly wordHighlights: readonly {
    readonly word: string
    readonly score0to100: number
    readonly band: string
  }[]
}

/** Build a turn record (pure; no IDB). */
export function createPracticeTurnRecord(
  input: CreatePracticeTurnInput,
  options?: {
    readonly id?: string
    readonly createdAtIso?: string
  },
): PracticeTurnRecord {
  return {
    id: options?.id ?? createStorageId('turn'),
    sessionId: input.sessionId,
    createdAtIso: options?.createdAtIso ?? new Date().toISOString(),
    scenarioId: input.scenarioId,
    transcribedText: input.transcribedText.trim(),
    correctedText: input.correctedText.trim(),
    tutorReplyText: input.tutorReplyText.trim(),
    tutorUsedFallback: input.tutorUsedFallback,
    pronunciationScore0to100: input.pronunciationScore0to100,
    mfccScore0to100: input.mfccScore0to100,
    pitchScore0to100: input.pitchScore0to100,
    formantF1InHertz: input.formantF1InHertz,
    formantF2InHertz: input.formantF2InHertz,
    formantF3InHertz: input.formantF3InHertz,
    wordHighlightSummary: summarizeWordHighlights(input.wordHighlights),
  }
}

export function createPracticeSessionRecord(
  scenarioId: StoredPracticeScenarioId,
  options?: {
    readonly id?: string
    readonly createdAtIso?: string
  },
): PracticeSessionRecord {
  const createdAtIso = options?.createdAtIso ?? new Date().toISOString()
  return {
    id: options?.id ?? createStorageId('session'),
    createdAtIso,
    updatedAtIso: createdAtIso,
    scenarioId,
  }
}

export function summarizeWordHighlights(
  highlights: readonly { readonly word: string; readonly band: string }[],
): string {
  if (highlights.length === 0) {
    return ''
  }
  return highlights.map((item) => `${item.word}:${item.band}`).join(' ')
}

export function createStorageId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
