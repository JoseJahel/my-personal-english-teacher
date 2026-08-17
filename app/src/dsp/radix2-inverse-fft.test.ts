import { describe, expect, it } from 'vitest'
import { radix2ForwardFft } from './radix2-forward-fft'
import { radix2InverseFft } from './radix2-inverse-fft'

describe('radix2InverseFft', () => {
  it('recovers a real impulse after a forward FFT', () => {
    const n = 16
    const real = new Float64Array(n)
    const imag = new Float64Array(n)
    real[3] = 1
    radix2ForwardFft(real, imag)
    radix2InverseFft(real, imag)
    for (let index = 0; index < n; index += 1) {
      expect(real[index]).toBeCloseTo(index === 3 ? 1 : 0, 12)
      expect(imag[index]).toBeCloseTo(0, 12)
    }
  })

  it('recovers a cosine occupying an exact bin', () => {
    const n = 32
    const bin = 4
    const original = new Float64Array(n)
    for (let index = 0; index < n; index += 1) {
      original[index] = Math.cos((2 * Math.PI * bin * index) / n)
    }
    const real = original.slice()
    const imag = new Float64Array(n)
    radix2ForwardFft(real, imag)
    radix2InverseFft(real, imag)
    for (let index = 0; index < n; index += 1) {
      expect(real[index]).toBeCloseTo(original[index] ?? 0, 10)
    }
  })
})
