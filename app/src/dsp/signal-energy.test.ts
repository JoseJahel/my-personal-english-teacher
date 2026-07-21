import { describe, expect, it } from 'vitest'
import { computeRootMeanSquareEnergy } from './signal-energy'

describe('computeRootMeanSquareEnergy', () => {
  it('devuelve 0 para una señal de silencio absoluto', () => {
    const silentSamples = new Float32Array(512)

    expect(computeRootMeanSquareEnergy(silentSamples)).toBe(0)
  })

  it('devuelve 0 para un arreglo vacío de muestras', () => {
    const emptySamples = new Float32Array(0)

    expect(computeRootMeanSquareEnergy(emptySamples)).toBe(0)
  })

  it('devuelve la propia amplitud para una señal constante', () => {
    const constantAmplitude = 0.5
    const constantSamples = new Float32Array(256).fill(constantAmplitude)

    expect(computeRootMeanSquareEnergy(constantSamples)).toBeCloseTo(constantAmplitude, 10)
  })

  it('devuelve amplitud / raíz de 2 para una onda senoidal pura', () => {
    const sampleCount = 4800
    const amplitude = 1
    const frequencyInHertz = 440
    const sampleRateInHertz = 48000

    const sineWaveSamples = new Float32Array(sampleCount)
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const timeInSeconds = sampleIndex / sampleRateInHertz
      sineWaveSamples[sampleIndex] =
        amplitude * Math.sin(2 * Math.PI * frequencyInHertz * timeInSeconds)
    }

    const expectedRmsEnergy = amplitude / Math.sqrt(2)
    expect(computeRootMeanSquareEnergy(sineWaveSamples)).toBeCloseTo(expectedRmsEnergy, 2)
  })

  it('crece a mayor amplitud manteniendo la misma forma de señal', () => {
    const lowAmplitudeSamples = new Float32Array(128).fill(0.1)
    const highAmplitudeSamples = new Float32Array(128).fill(0.8)

    expect(computeRootMeanSquareEnergy(highAmplitudeSamples)).toBeGreaterThan(
      computeRootMeanSquareEnergy(lowAmplitudeSamples),
    )
  })
})
