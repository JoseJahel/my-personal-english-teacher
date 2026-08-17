/**
 * Inverse radix-2 FFT via conjugation of the shared forward transform.
 * Recovers x[n] = (1/N) Σ X[k] e^{j 2π kn / N}.
 */

import { radix2ForwardFft, type FftBuffer } from './radix2-forward-fft'

export function radix2InverseFft(real: FftBuffer, imag: FftBuffer): void {
  const n = real.length
  if (n !== imag.length) {
    throw new Error(`IFFT real/imag lengths must match, got ${n} and ${imag.length}`)
  }
  for (let index = 0; index < n; index += 1) {
    imag[index] = -(imag[index] ?? 0)
  }
  radix2ForwardFft(real, imag)
  const scale = 1 / n
  for (let index = 0; index < n; index += 1) {
    real[index] = (real[index] ?? 0) * scale
    imag[index] = -(imag[index] ?? 0) * scale
  }
}
