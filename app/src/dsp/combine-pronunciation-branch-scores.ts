/**
 * Weighted mix of pronunciation branches. Missing branches drop out and
 * remaining weights are renormalized (issue #58).
 */

export interface PronunciationBranchWeights {
  readonly mfcc: number
  readonly pitch: number
  readonly energy: number
  readonly formant: number
}

/** MFCC stays dominant. Energy/formant weights are provisional (not #29-fitted). */
export const DEFAULT_PRONUNCIATION_BRANCH_WEIGHTS: PronunciationBranchWeights = {
  mfcc: 0.68,
  pitch: 0.18,
  energy: 0.07,
  formant: 0.07,
}

export interface PronunciationBranchScores {
  readonly mfccScore0to100: number
  readonly pitchScore0to100: number | null
  readonly energyScore0to100: number | null
  readonly formantScore0to100: number | null
  readonly weights?: Partial<PronunciationBranchWeights>
}

export function combinePronunciationBranchScores(input: PronunciationBranchScores): number {
  const defaults = DEFAULT_PRONUNCIATION_BRANCH_WEIGHTS
  const terms: Array<{ score: number; weight: number }> = [
    { score: input.mfccScore0to100, weight: input.weights?.mfcc ?? defaults.mfcc },
  ]
  if (input.pitchScore0to100 !== null) {
    terms.push({
      score: input.pitchScore0to100,
      weight: input.weights?.pitch ?? defaults.pitch,
    })
  }
  if (input.energyScore0to100 !== null) {
    terms.push({
      score: input.energyScore0to100,
      weight: input.weights?.energy ?? defaults.energy,
    })
  }
  if (input.formantScore0to100 !== null) {
    terms.push({
      score: input.formantScore0to100,
      weight: input.weights?.formant ?? defaults.formant,
    })
  }
  let weightSum = 0
  for (const term of terms) {
    weightSum += Math.max(0, term.weight)
  }
  if (weightSum <= 0) {
    return input.mfccScore0to100
  }
  let mixed = 0
  for (const term of terms) {
    mixed += term.score * (Math.max(0, term.weight) / weightSum)
  }
  return mixed
}
