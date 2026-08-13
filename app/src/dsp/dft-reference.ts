/**
 * Textbook O(N²) DFT used only to verify the radix-2 FFT (issue #66).
 * Product code (spectrogram / MFCC) must not import this module.
 *
 * X[k] = Σ_{n=0}^{N-1} x[n] e^{-j 2π kn / N}
 */

export interface ComplexSpectrum {
  readonly real: Float64Array
  readonly imag: Float64Array
}

export function computeNaiveDiscreteFourierTransform(
  realTime: ArrayLike<number>,
  imagTime?: ArrayLike<number>,
): ComplexSpectrum {
  const n = realTime.length
  const real = new Float64Array(n)
  const imag = new Float64Array(n)
  for (let bin = 0; bin < n; bin += 1) {
    let sumReal = 0
    let sumImag = 0
    for (let index = 0; index < n; index += 1) {
      const angle = (-2 * Math.PI * bin * index) / n
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const xReal = realTime[index] ?? 0
      const xImag = imagTime?.[index] ?? 0
      sumReal += xReal * cos - xImag * sin
      sumImag += xReal * sin + xImag * cos
    }
    real[bin] = sumReal
    imag[bin] = sumImag
  }
  return { real, imag }
}

export function computeMaximumAbsoluteSpectrumError(
  actualReal: ArrayLike<number>,
  actualImag: ArrayLike<number>,
  expectedReal: ArrayLike<number>,
  expectedImag: ArrayLike<number>,
): number {
  const n = actualReal.length
  let maximum = 0
  for (let bin = 0; bin < n; bin += 1) {
    const realError = Math.abs((actualReal[bin] ?? 0) - (expectedReal[bin] ?? 0))
    const imagError = Math.abs((actualImag[bin] ?? 0) - (expectedImag[bin] ?? 0))
    if (realError > maximum) {
      maximum = realError
    }
    if (imagError > maximum) {
      maximum = imagError
    }
  }
  return maximum
}
