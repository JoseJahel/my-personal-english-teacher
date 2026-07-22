/**
 * Acumulación de frames de audio: junta los bloques crudos que entrega
 * `subscribeToAudioFrames` (ver `audio/microphone-capture.ts`), cada uno del
 * tamaño de bloque del `AudioWorklet` (128 muestras por defecto), en una
 * única señal continua lista para resamplear con `audio-resampler.ts` camino
 * a Whisper.
 *
 * `concatenateAudioFrames` es una función pura (sin dependencias del
 * navegador): no toca `AudioContext` ni ninguna otra API de Web Audio, por lo
 * que puede probarse de forma aislada y ejecutarse tanto en el hilo principal
 * como dentro de un worker.
 */

/**
 * Concatena una lista de frames mono de audio, en el orden recibido, en una
 * única señal continua.
 *
 * @param frames - Frames de audio mono, típicamente acumulados mientras dura
 *   una captura de micrófono. Cada frame se copia a su posición en el
 *   resultado sin alterar sus valores.
 * @returns Una nueva señal cuya longitud es la suma de las longitudes de
 *   todos los frames de entrada. Devuelve un arreglo vacío si `frames` está
 *   vacío o si todos sus elementos lo están.
 */
export function concatenateAudioFrames(frames: Float32Array[]): Float32Array {
  const totalSampleCount = frames.reduce((sum, frame) => sum + frame.length, 0)
  const concatenatedSamples = new Float32Array(totalSampleCount)

  let writeOffset = 0
  for (const frame of frames) {
    concatenatedSamples.set(frame, writeOffset)
    writeOffset += frame.length
  }

  return concatenatedSamples
}
