/**
 * In-place Cooley–Tukey radix-2 decimation-in-time FFT.
 * Shared by spectrogram STFT and MFCC power spectra (issue #66).
 *
 * Unnormalized convention: X[k] = Σ x[n] e^{-j 2π kn / N}.
 * Verified against the O(N²) DFT in `dft-reference.ts` (tests only).
 */

export type FftBuffer = Float32Array | Float64Array

/** Max |X_fft − X_dft| on Float64 buffers of N ≤ 32 (measured in tests). */
export const RADIX2_FFT_MAX_ABSOLUTE_ERROR_VS_DFT = 1e-10

export function radix2ForwardFft(real: FftBuffer, imag: FftBuffer): void {
  const n = real.length
  if (n !== imag.length) {
    throw new Error(`FFT real/imag lengths must match, got ${n} and ${imag.length}`)
  }
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error(`FFT length must be a power of two, got ${n}`)
  }

  let j = 0
  for (let i = 1; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) {
      j ^= bit
    }
    j ^= bit
    if (i < j) {
      const realTemp = real[i] ?? 0
      real[i] = real[j] ?? 0
      real[j] = realTemp
      const imagTemp = imag[i] ?? 0
      imag[i] = imag[j] ?? 0
      imag[j] = imagTemp
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length
    const wLengthReal = Math.cos(angle)
    const wLengthImag = Math.sin(angle)
    for (let start = 0; start < n; start += length) {
      let wReal = 1
      let wImag = 0
      const half = length >> 1
      for (let offset = 0; offset < half; offset += 1) {
        const evenIndex = start + offset
        const oddIndex = evenIndex + half
        const oddReal = real[oddIndex] ?? 0
        const oddImag = imag[oddIndex] ?? 0
        const tReal = wReal * oddReal - wImag * oddImag
        const tImag = wReal * oddImag + wImag * oddReal
        real[oddIndex] = (real[evenIndex] ?? 0) - tReal
        imag[oddIndex] = (imag[evenIndex] ?? 0) - tImag
        real[evenIndex] = (real[evenIndex] ?? 0) + tReal
        imag[evenIndex] = (imag[evenIndex] ?? 0) + tImag
        const nextWReal = wReal * wLengthReal - wImag * wLengthImag
        wImag = wReal * wLengthImag + wImag * wLengthReal
        wReal = nextWReal
      }
    }
  }
}
