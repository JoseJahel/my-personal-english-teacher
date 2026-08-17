/**
 * Voice bandpass: 2nd-order Butterworth high-pass + low-pass (RBJ biquads).
 * Issue #73. One causal pass — not filtfilt / zero-phase. Applying twice
 * is a 4th-order filter, not a no-op.
 */

/** High-pass edge: drop rumble / DC below speech F0. */
export const VOICE_BANDPASS_HIGHPASS_HZ = 80
/** Low-pass edge: keep speech, drop residual highs after 16 kHz resample. */
export const VOICE_BANDPASS_LOWPASS_HZ = 7500
/** In-band probe used by tests and the verification report. */
export const VOICE_BANDPASS_IN_BAND_PROBE_HZ = 1000
/** Rumble probe well below the high-pass edge (2nd-order ≈ −24 dB). */
export const VOICE_BANDPASS_RUMBLE_PROBE_HZ = 20
/** Floor asserted on the rumble probe (theory ≈ 24 dB at 20 Hz). */
export const VOICE_BANDPASS_MIN_STOPBAND_ATTENUATION_DB = 20
/** Butterworth Q = 1/√2 → −3 dB at each designed cutoff. */
export const VOICE_BANDPASS_BUTTERWORTH_Q = 1 / Math.SQRT2

export interface BiquadSection {
  readonly b0: number
  readonly b1: number
  readonly b2: number
  readonly a1: number
  readonly a2: number
}

export function designButterworthHighpass(
  cutoffFrequencyInHertz: number,
  sampleRateInHertz: number,
): BiquadSection | null {
  return designRbqBiquad('highpass', cutoffFrequencyInHertz, sampleRateInHertz)
}

export function designButterworthLowpass(
  cutoffFrequencyInHertz: number,
  sampleRateInHertz: number,
): BiquadSection | null {
  return designRbqBiquad('lowpass', cutoffFrequencyInHertz, sampleRateInHertz)
}

/**
 * HP then LP at the documented voice edges. Missing sections are skipped
 * (cutoff at or above Nyquist, or non-finite rate).
 */
export function designVoiceBandpassSections(
  sampleRateInHertz: number,
): readonly BiquadSection[] {
  const sections: BiquadSection[] = []
  const highpass = designButterworthHighpass(
    VOICE_BANDPASS_HIGHPASS_HZ,
    sampleRateInHertz,
  )
  const lowpass = designButterworthLowpass(
    VOICE_BANDPASS_LOWPASS_HZ,
    sampleRateInHertz,
  )
  if (highpass) {
    sections.push(highpass)
  }
  if (lowpass) {
    sections.push(lowpass)
  }
  return sections
}

export function applyBiquadSections(
  samples: Float32Array,
  sections: readonly BiquadSection[],
): Float32Array {
  if (samples.length === 0) {
    return new Float32Array(0)
  }
  if (sections.length === 0) {
    return samples.slice()
  }
  let current = samples
  for (const section of sections) {
    current = applyOneBiquad(current, section)
  }
  return current
}

/**
 * Single-pass voice bandpass. Empty / unusable rate → empty or a copy.
 */
export function applyVoiceBandpass(
  samples: Float32Array,
  sampleRateInHertz: number,
): Float32Array {
  if (samples.length === 0) {
    return new Float32Array(0)
  }
  if (!Number.isFinite(sampleRateInHertz) || sampleRateInHertz <= 0) {
    return samples.slice()
  }
  return applyBiquadSections(samples, designVoiceBandpassSections(sampleRateInHertz))
}

function designRbqBiquad(
  kind: 'highpass' | 'lowpass',
  cutoffFrequencyInHertz: number,
  sampleRateInHertz: number,
): BiquadSection | null {
  if (
    !Number.isFinite(cutoffFrequencyInHertz) ||
    !Number.isFinite(sampleRateInHertz) ||
    cutoffFrequencyInHertz <= 0 ||
    sampleRateInHertz <= 0 ||
    cutoffFrequencyInHertz >= sampleRateInHertz / 2
  ) {
    return null
  }
  const omega = (2 * Math.PI * cutoffFrequencyInHertz) / sampleRateInHertz
  const cosOmega = Math.cos(omega)
  const sinOmega = Math.sin(omega)
  const alpha = sinOmega / (2 * VOICE_BANDPASS_BUTTERWORTH_Q)
  const a0 = 1 + alpha
  if (a0 === 0 || !Number.isFinite(a0)) {
    return null
  }
  if (kind === 'highpass') {
    const b0 = (1 + cosOmega) / 2
    return {
      b0: b0 / a0,
      b1: -(1 + cosOmega) / a0,
      b2: b0 / a0,
      a1: (-2 * cosOmega) / a0,
      a2: (1 - alpha) / a0,
    }
  }
  const b0 = (1 - cosOmega) / 2
  return {
    b0: b0 / a0,
    b1: (1 - cosOmega) / a0,
    b2: b0 / a0,
    a1: (-2 * cosOmega) / a0,
    a2: (1 - alpha) / a0,
  }
}

/** Direct Form II Transposed. One section, zero initial state. */
function applyOneBiquad(samples: Float32Array, section: BiquadSection): Float32Array {
  const output = new Float32Array(samples.length)
  let delay1 = 0
  let delay2 = 0
  for (let index = 0; index < samples.length; index += 1) {
    const input = samples[index] ?? 0
    const value = section.b0 * input + delay1
    delay1 = section.b1 * input - section.a1 * value + delay2
    delay2 = section.b2 * input - section.a2 * value
    output[index] = value
  }
  return output
}
