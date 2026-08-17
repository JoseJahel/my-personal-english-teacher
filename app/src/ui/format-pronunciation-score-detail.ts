export interface PronunciationScoreDetailInput {
  readonly mfccScore: number
  readonly pitchScore: number | null
  readonly energyScore: number | null
  readonly formantScore: number | null
  readonly userFrames: number
  readonly referenceFrames: number
}

/** Spanish one-line breakdown for the feedback panel (issue #58). */
export function formatPronunciationScoreDetail(details: PronunciationScoreDetailInput): string {
  const parts = [`MFCC ${details.mfccScore.toFixed(1)}`]
  if (details.pitchScore !== null) {
    parts.push(`pitch ${details.pitchScore.toFixed(1)}`)
  }
  if (details.energyScore !== null) {
    parts.push(`energía ${details.energyScore.toFixed(1)}`)
  }
  if (details.formantScore !== null) {
    parts.push(`formantes ${details.formantScore.toFixed(1)}`)
  }
  parts.push(`frames usuario ${details.userFrames} / ref ${details.referenceFrames}`)
  return parts.join(' · ')
}
