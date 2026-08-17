/**
 * User-only ASR preprocess (issue #63): shared #73 chain, then stationary
 * noise reduction. Never used on the TTS reference so the score stays fair.
 */

import { reduceStationaryNoiseFromMonoPcm } from '../dsp/reduce-stationary-noise'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from './audio-resampler'
import { prepareSpeechPcmForModels } from './prepare-speech-pcm'

export function prepareUserSpeechPcmForAsr(
  samples: Float32Array,
  inputSampleRateInHertz: number,
  outputSampleRateInHertz: number = WHISPER_SAMPLE_RATE_IN_HERTZ,
): Float32Array {
  const prepared = prepareSpeechPcmForModels(
    samples,
    inputSampleRateInHertz,
    outputSampleRateInHertz,
  )
  return reduceStationaryNoiseFromMonoPcm(prepared, outputSampleRateInHertz)
}
