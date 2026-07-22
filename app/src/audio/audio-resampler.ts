/**
 * Resampleo de audio: conversión de una señal PCM capturada a la tasa nativa
 * del dispositivo (habitualmente 44.1 kHz o 48 kHz) a la tasa de 16 kHz mono
 * que exige Whisper, la misma que consume el extractor de MFCC del futuro
 * comparador de pronunciación (ver la convención de "audio de doble rama" en
 * el README raíz del repositorio).
 *
 * El núcleo, `resampleAudioSamples`, es una función pura sin dependencias del
 * navegador: no toca `AudioContext` ni ninguna otra API de Web Audio, por lo
 * que puede probarse de forma aislada y ejecutarse tanto en el hilo principal
 * como dentro de un worker.
 *
 * **Limitación conocida:** la interpolación lineal usada aquí NO aplica un
 * filtro pasa-bajos anti-aliasing antes de reducir la tasa de muestreo.
 * Estrictamente, el teorema de muestreo exige eliminar el contenido espectral
 * por encima de la nueva frecuencia de Nyquist (8 kHz al resamplear a 16 kHz)
 * antes de decimar; si no se hace, la energía por encima de ese límite se
 * "dobla" hacia frecuencias más bajas y contamina la señal (aliasing). Para
 * el prototipo del Avance 1 esto se acepta como suficiente: la voz humana
 * concentra la mayor parte de su energía muy por debajo de 8 kHz y Whisper es
 * razonablemente tolerante a esta degradación. Una mejora futura evidente es
 * anteponer un filtro pasa-bajos (por ejemplo, un `BiquadFilterNode` antes de
 * leer las muestras, o un filtro FIR/IIR implementado como función pura en
 * `dsp/`) antes de esta interpolación.
 */

/**
 * Re-muestrea una señal mono de audio de `inputSampleRate` a
 * `outputSampleRate` Hz mediante interpolación lineal entre las dos muestras
 * de entrada más cercanas a cada instante de salida.
 *
 * @param samples - Muestras de audio mono en el rango [-1, 1].
 * @param inputSampleRate - Tasa de muestreo original de `samples`, en Hz.
 * @param outputSampleRate - Tasa de muestreo deseada para la señal de salida,
 *   en Hz.
 * @returns Una nueva señal con, aproximadamente,
 *   `samples.length * outputSampleRate / inputSampleRate` muestras. Devuelve
 *   un arreglo vacío si `samples` está vacío.
 */
export function resampleAudioSamples(
  samples: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (samples.length === 0) {
    return new Float32Array(0)
  }

  if (inputSampleRate === outputSampleRate) {
    return samples.slice()
  }

  const resamplingRatio = outputSampleRate / inputSampleRate
  const outputSampleCount = Math.max(1, Math.round(samples.length * resamplingRatio))
  const resampledSamples = new Float32Array(outputSampleCount)
  const lastInputSampleIndex = samples.length - 1

  for (let outputIndex = 0; outputIndex < outputSampleCount; outputIndex += 1) {
    // Posición (fraccionaria) que le corresponde a esta muestra de salida
    // dentro de la señal de entrada.
    const inputPosition = outputIndex / resamplingRatio
    const previousSampleIndex = Math.min(Math.floor(inputPosition), lastInputSampleIndex)
    const nextSampleIndex = Math.min(previousSampleIndex + 1, lastInputSampleIndex)
    const interpolationFraction = inputPosition - previousSampleIndex

    const previousSampleValue = samples[previousSampleIndex]
    const nextSampleValue = samples[nextSampleIndex]

    resampledSamples[outputIndex] =
      previousSampleValue + (nextSampleValue - previousSampleValue) * interpolationFraction
  }

  return resampledSamples
}

/** Tasa de muestreo, en Hz, que exige el modelo Whisper (y el MFCC propio). */
export const WHISPER_SAMPLE_RATE_IN_HERTZ = 16000

/**
 * Atajo sobre `resampleAudioSamples` que fija la tasa de salida a
 * `WHISPER_SAMPLE_RATE_IN_HERTZ` (16 kHz), la tasa que requiere Whisper.
 *
 * @param samples - Muestras de audio mono en el rango [-1, 1], a la tasa
 *   nativa del dispositivo.
 * @param inputSampleRate - Tasa de muestreo original de `samples`, en Hz.
 */
export function resampleToWhisperRate(
  samples: Float32Array,
  inputSampleRate: number,
): Float32Array {
  return resampleAudioSamples(samples, inputSampleRate, WHISPER_SAMPLE_RATE_IN_HERTZ)
}
