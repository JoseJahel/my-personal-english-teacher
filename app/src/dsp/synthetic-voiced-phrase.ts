/**
 * Tiny source-filter voiced phrase for speaker-bias tests (issue #95).
 * Impulse train + three cascade formant resonators. No recorded audio.
 */

export const SYNTHETIC_VOICE_SAMPLE_RATE_HZ = 16000

export const SYNTHETIC_VOWEL_FORMANTS_HZ = {
  a: { f1: 730, f2: 1090, f3: 2440 },
  i: { f1: 270, f2: 2290, f3: 3010 },
  u: { f1: 300, f2: 870, f3: 2240 },
} as const

export type SyntheticVowelId = keyof typeof SYNTHETIC_VOWEL_FORMANTS_HZ

export interface SynthesizeVoicedPhraseOptions {
  readonly fundamentalFrequencyInHertz: number
  readonly vowelIds: readonly SyntheticVowelId[]
  readonly vowelDurationSeconds?: number
  readonly sampleRateInHertz?: number
}

interface FormantTriple {
  readonly f1: number
  readonly f2: number
  readonly f3: number
}

export function synthesizeVoicedPhrase(options: SynthesizeVoicedPhraseOptions): Float32Array {
  const sampleRate = options.sampleRateInHertz ?? SYNTHETIC_VOICE_SAMPLE_RATE_HZ
  const vowelDuration = options.vowelDurationSeconds ?? 0.14
  if (
    options.vowelIds.length === 0 ||
    !(options.fundamentalFrequencyInHertz > 0) ||
    !(sampleRate > 0)
  ) {
    return new Float32Array(0)
  }

  const segmentLength = Math.max(32, Math.round(vowelDuration * sampleRate))
  const fadeLength = Math.min(80, Math.floor(segmentLength / 4))
  const hop = segmentLength - fadeLength
  const totalLength = hop * (options.vowelIds.length - 1) + segmentLength
  const output = new Float32Array(totalLength)

  for (let vowelIndex = 0; vowelIndex < options.vowelIds.length; vowelIndex += 1) {
    const vowelId = options.vowelIds[vowelIndex]
    if (!vowelId) {
      continue
    }
    const segment = synthesizeVowelSegment(
      SYNTHETIC_VOWEL_FORMANTS_HZ[vowelId],
      options.fundamentalFrequencyInHertz,
      sampleRate,
      segmentLength,
    )
    applyTukeyFade(segment, fadeLength)
    const offset = vowelIndex * hop
    addInPlace(output, segment, offset)
  }
  normalizePeak(output, 0.45)
  return output
}

function synthesizeVowelSegment(
  formants: FormantTriple,
  fundamentalFrequencyInHertz: number,
  sampleRate: number,
  length: number,
): Float32Array {
  const source = createGlottalSource(fundamentalFrequencyInHertz, sampleRate, length)
  const afterF1 = applyFormantResonator(source, formants.f1, 90, sampleRate)
  const afterF2 = applyFormantResonator(afterF1, formants.f2, 110, sampleRate)
  return applyFormantResonator(afterF2, formants.f3, 170, sampleRate)
}

function createGlottalSource(
  fundamentalFrequencyInHertz: number,
  sampleRate: number,
  length: number,
): Float32Array {
  const source = new Float32Array(length)
  const omega = (2 * Math.PI * fundamentalFrequencyInHertz) / sampleRate
  const harmonicCount = 8
  for (let index = 0; index < length; index += 1) {
    let sample = 0
    for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
      sample += Math.sin(omega * harmonic * index) / harmonic
    }
    source[index] = sample
  }
  return source
}

function applyFormantResonator(
  input: Float32Array,
  centerFrequencyInHertz: number,
  bandwidthInHertz: number,
  sampleRate: number,
): Float32Array {
  const radius = Math.exp((-Math.PI * bandwidthInHertz) / sampleRate)
  const cosine = Math.cos((2 * Math.PI * centerFrequencyInHertz) / sampleRate)
  const feedback1 = 2 * radius * cosine
  const feedback2 = -radius * radius
  const gain = 1 - feedback1 - feedback2
  const output = new Float32Array(input.length)
  let delayed1 = 0
  let delayed2 = 0
  for (let index = 0; index < input.length; index += 1) {
    const current = gain * (input[index] ?? 0) + feedback1 * delayed1 + feedback2 * delayed2
    output[index] = current
    delayed2 = delayed1
    delayed1 = current
  }
  return output
}

function applyTukeyFade(samples: Float32Array, fadeLength: number): void {
  if (fadeLength <= 0 || samples.length < fadeLength * 2) {
    return
  }
  for (let index = 0; index < fadeLength; index += 1) {
    const weight = 0.5 - 0.5 * Math.cos((Math.PI * index) / fadeLength)
    samples[index] = (samples[index] ?? 0) * weight
    const endIndex = samples.length - 1 - index
    samples[endIndex] = (samples[endIndex] ?? 0) * weight
  }
}

function addInPlace(target: Float32Array, source: Float32Array, offset: number): void {
  for (let index = 0; index < source.length; index += 1) {
    const destination = offset + index
    if (destination >= target.length) {
      break
    }
    target[destination] = (target[destination] ?? 0) + (source[index] ?? 0)
  }
}

function normalizePeak(samples: Float32Array, targetPeak: number): void {
  let peak = 0
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample))
  }
  if (peak < 1e-8) {
    return
  }
  const scale = targetPeak / peak
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (samples[index] ?? 0) * scale
  }
}
