import { describe, expect, it } from 'vitest'
import {
  computeMaximumAbsoluteSpectrumError,
  computeNaiveDiscreteFourierTransform,
} from './dft-reference'
import {
  RADIX2_FFT_MAX_ABSOLUTE_ERROR_VS_DFT,
  radix2ForwardFft,
} from './radix2-forward-fft'

describe('radix2ForwardFft versus textbook DFT', () => {
  it('matches the O(N²) DFT of an impulse within the documented error bound', () => {
    const n = 16
    const real = new Float64Array(n)
    const imag = new Float64Array(n)
    real[0] = 1
    const reference = computeNaiveDiscreteFourierTransform(real, imag)
    radix2ForwardFft(real, imag)
    const error = computeMaximumAbsoluteSpectrumError(real, imag, reference.real, reference.imag)
    expect(error).toBeLessThan(RADIX2_FFT_MAX_ABSOLUTE_ERROR_VS_DFT)
    for (let bin = 0; bin < n; bin += 1) {
      expect(reference.real[bin]).toBeCloseTo(1, 12)
      expect(reference.imag[bin]).toBeCloseTo(0, 12)
    }
  })

  it('matches the DFT of a real cosine that occupies an exact bin', () => {
    const n = 32
    const bin = 5
    const real = new Float64Array(n)
    const imag = new Float64Array(n)
    for (let index = 0; index < n; index += 1) {
      real[index] = Math.cos((2 * Math.PI * bin * index) / n)
    }
    const reference = computeNaiveDiscreteFourierTransform(real, imag)
    radix2ForwardFft(real, imag)
    const error = computeMaximumAbsoluteSpectrumError(real, imag, reference.real, reference.imag)
    expect(error).toBeLessThan(RADIX2_FFT_MAX_ABSOLUTE_ERROR_VS_DFT)

    let peakBin = 0
    let peakPower = 0
    for (let k = 0; k < n; k += 1) {
      const power = (real[k] ?? 0) ** 2 + (imag[k] ?? 0) ** 2
      if (power > peakPower) {
        peakPower = power
        peakBin = k
      }
    }
    expect(peakBin === bin || peakBin === n - bin).toBe(true)
  })

  it('satisfies Parseval: sum |x[n]|² equals (1/N) sum |X[k]|²', () => {
    const n = 32
    const real = new Float64Array(n)
    const imag = new Float64Array(n)
    for (let index = 0; index < n; index += 1) {
      real[index] = Math.sin((2 * Math.PI * 3 * index) / n) + 0.25 * Math.cos((2 * Math.PI * 7 * index) / n)
    }
    let timeEnergy = 0
    for (let index = 0; index < n; index += 1) {
      timeEnergy += (real[index] ?? 0) ** 2 + (imag[index] ?? 0) ** 2
    }
    radix2ForwardFft(real, imag)
    let frequencyEnergy = 0
    for (let bin = 0; bin < n; bin += 1) {
      frequencyEnergy += (real[bin] ?? 0) ** 2 + (imag[bin] ?? 0) ** 2
    }
    expect(Math.abs(timeEnergy - frequencyEnergy / n)).toBeLessThan(
      RADIX2_FFT_MAX_ABSOLUTE_ERROR_VS_DFT,
    )
  })

  it('rejects a length that is not a power of two', () => {
    expect(() => radix2ForwardFft(new Float64Array(6), new Float64Array(6))).toThrow(/power of two/i)
  })
})
