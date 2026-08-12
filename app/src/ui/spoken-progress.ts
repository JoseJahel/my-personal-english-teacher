/**
 * Spoken progress for tutor TTS barge-in (issue #46).
 * Pure helpers: estimate what the learner heard from cutoffMs + full text.
 */

export interface SpokenProgress {
  readonly utteranceId: string
  readonly fullText: string
  readonly spokenText: string
  readonly cutoffTokenIndex: number
  readonly cutoffMs: number
  readonly completed: boolean
}

/** Serializable mirror for IndexedDB (same shape). */
export type SpokenProgressRecord = SpokenProgress

export interface BuildSpokenProgressInput {
  readonly utteranceId: string
  readonly fullText: string
  /** Milliseconds actually played (from playMonoPcmSamples.cutoffMs). */
  readonly cutoffMs: number
  /** Full clip duration in ms; when omitted, estimated from word count. */
  readonly totalDurationMs?: number
  readonly completed: boolean
}

/**
 * Build spoken_progress from TTS playback result.
 * Token/cutoff mapping is proportional by word weight so the UI can reason
 * about the fragment the user actually heard.
 */
export function buildSpokenProgress(input: BuildSpokenProgressInput): SpokenProgress {
  const fullText = input.fullText.trim()
  const tokens = tokenizeSpokenWords(fullText)
  const totalDurationMs = resolveTotalDurationMs(input.totalDurationMs, tokens.length)

  if (tokens.length === 0) {
    return {
      utteranceId: input.utteranceId,
      fullText,
      spokenText: '',
      cutoffTokenIndex: 0,
      cutoffMs: Math.max(0, Math.round(input.cutoffMs)),
      completed: input.completed,
    }
  }

  if (input.completed || input.cutoffMs >= totalDurationMs) {
    return {
      utteranceId: input.utteranceId,
      fullText,
      spokenText: fullText,
      cutoffTokenIndex: tokens.length,
      cutoffMs: Math.max(0, Math.round(Math.min(input.cutoffMs, totalDurationMs))),
      completed: true,
    }
  }

  const ratio = clamp01(input.cutoffMs / totalDurationMs)
  const spokenTokenCount = estimateSpokenTokenCount(tokens.length, ratio)
  const spokenText = tokens.slice(0, spokenTokenCount).join(' ')

  return {
    utteranceId: input.utteranceId,
    fullText,
    spokenText,
    cutoffTokenIndex: spokenTokenCount,
    cutoffMs: Math.max(0, Math.round(input.cutoffMs)),
    completed: false,
  }
}

/**
 * True when almost nothing useful was heard (Case C — early cutoff).
 * Empty spoken text, or under 15% of tokens / under 250 ms of audio.
 */
export function isEarlyCutoffSpokenProgress(progress: SpokenProgress): boolean {
  if (progress.completed) {
    return false
  }
  const tokens = tokenizeSpokenWords(progress.fullText)
  if (tokens.length === 0) {
    return true
  }
  if (progress.spokenText.trim().length === 0) {
    return true
  }
  if (progress.cutoffMs > 0 && progress.cutoffMs < 250) {
    return true
  }
  return progress.cutoffTokenIndex / tokens.length < 0.15
}

/** Remaining words the tutor still owed after a mid-utterance cut. */
export function remainingUnspokenText(progress: SpokenProgress): string {
  if (progress.completed) {
    return ''
  }
  const tokens = tokenizeSpokenWords(progress.fullText)
  if (progress.cutoffTokenIndex >= tokens.length) {
    return ''
  }
  return tokens.slice(progress.cutoffTokenIndex).join(' ')
}

export function tokenizeSpokenWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function estimateSpokenTokenCount(tokenCount: number, ratio: number): number {
  if (tokenCount <= 0 || ratio <= 0) {
    return 0
  }
  if (ratio >= 1) {
    return tokenCount
  }
  // Floor so we never claim a word the user did not hear.
  return Math.min(tokenCount, Math.floor(ratio * tokenCount + 1e-9))
}

function resolveTotalDurationMs(
  totalDurationMs: number | undefined,
  tokenCount: number,
): number {
  if (totalDurationMs !== undefined && totalDurationMs > 0) {
    return totalDurationMs
  }
  // ~280 ms per word fallback when the caller has no clip duration.
  return Math.max(400, tokenCount * 280)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}
