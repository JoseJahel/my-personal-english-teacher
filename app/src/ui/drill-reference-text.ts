/**
 * Pure helper: resolve and validate the drill's reference text (the tutor's
 * last line). Extracted from use-drill-repetition.ts so this decision is
 * unit-testable without React or a live microphone.
 */

export interface ResolvedDrillReference {
  readonly isAvailable: boolean
  readonly referenceTextEn: string
}

/**
 * Trims the raw tutor line and reports whether it's usable as a drill
 * reference. Empty/whitespace-only lines are never usable.
 */
export function resolveDrillReferenceText(rawTutorLineEn: string): ResolvedDrillReference {
  const referenceTextEn = rawTutorLineEn.trim()
  return {
    isAvailable: referenceTextEn.length > 0,
    referenceTextEn,
  }
}
