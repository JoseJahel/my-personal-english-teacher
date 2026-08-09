/**
 * Serializable practice records for IndexedDB (no raw audio, ever).
 * Scenario ids mirror `ui/practice-scenarios` without importing UI (layer rule).
 */

/** Keep in sync with PracticeScenarioId in ui/practice-scenarios.ts */
export type StoredPracticeScenarioId = 'restaurant' | 'airport' | 'job-interview'

/**
 * How much of a tutor TTS utterance the learner actually heard (issue #46).
 * Stored without raw audio; used to resume scene state after barge-in.
 */
export interface StoredSpokenProgress {
  readonly utteranceId: string
  readonly fullText: string
  readonly spokenText: string
  readonly cutoffTokenIndex: number
  readonly cutoffMs: number
  readonly completed: boolean
}

/** One practice session (scenario + time window). */
export interface PracticeSessionRecord {
  readonly id: string
  readonly createdAtIso: string
  readonly updatedAtIso: string
  readonly scenarioId: StoredPracticeScenarioId
  /**
   * Pending barge-in state when the tutor was interrupted mid-utterance
   * (completed === false). Survives PWA reload (Case D of issue #46).
   */
  readonly pendingSpokenProgress: StoredSpokenProgress | null
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
  /** Spoken progress of the tutor reply for this turn (null if unknown). */
  readonly spokenProgress: StoredSpokenProgress | null
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
  readonly spokenProgress?: StoredSpokenProgress | null
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
    spokenProgress: input.spokenProgress ?? null,
  }
}

export function createPracticeSessionRecord(
  scenarioId: StoredPracticeScenarioId,
  options?: {
    readonly id?: string
    readonly createdAtIso?: string
    readonly pendingSpokenProgress?: StoredSpokenProgress | null
  },
): PracticeSessionRecord {
  const createdAtIso = options?.createdAtIso ?? new Date().toISOString()
  return {
    id: options?.id ?? createStorageId('session'),
    createdAtIso,
    updatedAtIso: createdAtIso,
    scenarioId,
    pendingSpokenProgress: options?.pendingSpokenProgress ?? null,
  }
}

/** Normalize legacy sessions that predate pendingSpokenProgress. */
export function normalizePracticeSessionRecord(
  record: PracticeSessionRecord | (Omit<PracticeSessionRecord, 'pendingSpokenProgress'> & {
    pendingSpokenProgress?: StoredSpokenProgress | null
  }),
): PracticeSessionRecord {
  return {
    id: record.id,
    createdAtIso: record.createdAtIso,
    updatedAtIso: record.updatedAtIso,
    scenarioId: record.scenarioId,
    pendingSpokenProgress: record.pendingSpokenProgress ?? null,
  }
}

/** Normalize legacy turns that predate spokenProgress. */
export function normalizePracticeTurnRecord(
  record: PracticeTurnRecord | (Omit<PracticeTurnRecord, 'spokenProgress'> & {
    spokenProgress?: StoredSpokenProgress | null
  }),
): PracticeTurnRecord {
  return {
    ...record,
    spokenProgress: record.spokenProgress ?? null,
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
