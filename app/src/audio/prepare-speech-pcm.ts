/**
 * Shared speech PCM chain (issue #73): resample, then one voice bandpass pass.
 * User and TTS reference must call this with the same output rate so the
 * pronunciation score does not compare two different preprocess paths.
 */

import { applyVoiceBandpass } from '../dsp/biquad-voice-bandpass'
import { resampleAudioSamples, WHISPER_SAMPLE_RATE_IN_HERTZ } from './audio-resampler'

export function prepareSpeechPcmForModels(
  samples: Float32Array,
  inputSampleRateInHertz: number,
  outputSampleRateInHertz: number = WHISPER_SAMPLE_RATE_IN_HERTZ,
): Float32Array {
  const resampled = resampleAudioSamples(
    samples,
    inputSampleRateInHertz,
    outputSampleRateInHertz,
  )
  if (resampled.length === 0) {
    return resampled
  }
  return applyVoiceBandpass(resampled, outputSampleRateInHertz)
}
