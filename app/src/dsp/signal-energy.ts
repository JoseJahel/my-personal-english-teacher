/**
 * Calcula la energía RMS (Root Mean Square) de una señal de audio.
 *
 * La energía RMS resume qué tan "fuerte" es una señal en un instante dado,
 * combinando todas sus muestras en un único número no negativo. Es la métrica
 * más simple y barata para distinguir silencio de voz, por lo que sirve como
 * base del futuro detector de actividad de voz (VAD) en `audio/voice-activity-monitor.ts`:
 * cuando la energía supera un umbral durante suficiente tiempo, se considera
 * que hay habla presente.
 *
 * Es una función pura: no depende de APIs del navegador ni mantiene estado,
 * por lo que puede probarse de forma aislada y ejecutarse tanto en el hilo
 * principal como dentro de un Web Worker.
 *
 * @param samples - Muestras de audio en formato PCM de punto flotante, en el
 *   rango [-1, 1], como las que entrega la Web Audio API.
 * @returns La energía RMS de las muestras. Es 0 para una señal vacía o en
 *   silencio absoluto, y crece con la amplitud de la señal.
 */
export function computeRootMeanSquareEnergy(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0
  }

  let sumOfSquares = 0
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const sampleValue = samples[sampleIndex]
    sumOfSquares += sampleValue * sampleValue
  }

  const meanOfSquares = sumOfSquares / samples.length
  return Math.sqrt(meanOfSquares)
}
