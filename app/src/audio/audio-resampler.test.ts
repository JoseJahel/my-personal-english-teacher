import { describe, expect, it } from 'vitest'
import {
  resampleAudioSamples,
  resampleToWhisperRate,
  WHISPER_SAMPLE_RATE_IN_HERTZ,
} from './audio-resampler'

describe('resampleAudioSamples', () => {
  it('devuelve un arreglo vacío cuando la entrada está vacía', () => {
    const emptySamples = new Float32Array(0)

    expect(resampleAudioSamples(emptySamples, 48000, 16000).length).toBe(0)
  })

  it('devuelve las mismas muestras cuando la tasa de entrada y de salida coinciden', () => {
    const samples = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5])

    const resampled = resampleAudioSamples(samples, 44100, 44100)

    expect(Array.from(resampled)).toEqual(Array.from(samples))
  })

  it('produce aproximadamente un tercio de las muestras al pasar de 48 kHz a 16 kHz', () => {
    const durationInSeconds = 0.1
    const inputSampleRate = 48000
    const samples = new Float32Array(inputSampleRate * durationInSeconds)

    const resampled = resampleAudioSamples(samples, inputSampleRate, 16000)

    expect(resampled.length).toBe(samples.length / 3)
  })

  it('preserva el valor de una señal constante', () => {
    const constantAmplitude = 0.42
    const constantSamples = new Float32Array(480).fill(constantAmplitude)

    const resampled = resampleAudioSamples(constantSamples, 48000, 16000)

    expect(resampled.length).toBeGreaterThan(0)
    for (const sampleValue of resampled) {
      // Precisión 5 (no más): las muestras están en Float32Array, con solo
      // ~7 dígitos decimales significativos de precisión.
      expect(sampleValue).toBeCloseTo(constantAmplitude, 5)
    }
  })

  it('conserva la frecuencia de una senoidal de 440 Hz al pasar de 48 kHz a 16 kHz', () => {
    const inputSampleRate = 48000
    const outputSampleRate = 16000
    const frequencyInHertz = 440
    const durationInSeconds = 0.5
    const sampleCount = Math.round(inputSampleRate * durationInSeconds)

    const sineWaveSamples = new Float32Array(sampleCount)
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const timeInSeconds = sampleIndex / inputSampleRate
      sineWaveSamples[sampleIndex] = Math.sin(2 * Math.PI * frequencyInHertz * timeInSeconds)
    }

    const resampledSamples = resampleAudioSamples(
      sineWaveSamples,
      inputSampleRate,
      outputSampleRate,
    )

    // La frecuencia se estima contando cruces por cero ascendentes: una
    // senoidal de f Hz cruza el cero de negativo a positivo f veces por segundo.
    let positiveGoingZeroCrossingCount = 0
    for (let sampleIndex = 1; sampleIndex < resampledSamples.length; sampleIndex += 1) {
      const previousSample = resampledSamples[sampleIndex - 1]
      const currentSample = resampledSamples[sampleIndex]
      if (previousSample < 0 && currentSample >= 0) {
        positiveGoingZeroCrossingCount += 1
      }
    }

    const resampledDurationInSeconds = resampledSamples.length / outputSampleRate
    const estimatedFrequencyInHertz = positiveGoingZeroCrossingCount / resampledDurationInSeconds

    expect(estimatedFrequencyInHertz).toBeCloseTo(frequencyInHertz, -1)
  })
})

describe('resampleToWhisperRate', () => {
  it('fija la tasa de salida en 16 kHz', () => {
    const samples = new Float32Array(4800)

    const resampled = resampleToWhisperRate(samples, 48000)

    expect(resampled.length).toBe(samples.length * (WHISPER_SAMPLE_RATE_IN_HERTZ / 48000))
  })
})
