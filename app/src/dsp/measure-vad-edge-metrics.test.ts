import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VAD_SILENCE_HANGOVER_MS,
  DEFAULT_VAD_MINIMUM_SPEECH_MS,
} from './voice-activity-detection'
import {
  VAD_EDGE_HOP_MS,
  VAD_EDGE_MAX_ABS_END_ERROR_MS,
  VAD_EDGE_MAX_ABS_HANGOVER_ERROR_MS,
  VAD_EDGE_MAX_ABS_START_ERROR_MS,
  VAD_EDGE_MEASURED_END_ERROR_MS,
  VAD_EDGE_MEASURED_HANGOVER_ERROR_MS,
  VAD_EDGE_MEASURED_START_ERROR_MS,
  createSilenceToneSilencePcm,
  measureEnergyVadEdgeMetrics,
} from './measure-vad-edge-metrics'

describe('createSilenceToneSilencePcm', () => {
  it('lays out silence, tone, silence at the labeled times', () => {
    const sampleRate = 16_000
    const pcm = createSilenceToneSilencePcm({
      sampleRateInHertz: sampleRate,
      leadingSilenceMs: 320,
      speechMs: 800,
      trailingSilenceMs: 160,
      frequencyInHertz: 200,
      amplitude: 0.4,
    })
    expect(pcm.samples.length).toBe(Math.round(sampleRate * 1.280))
    expect(pcm.speechStartMs).toBe(320)
    expect(pcm.speechEndMs).toBe(1120)
    const midStart = Math.round(sampleRate * 0.7)
    let midPeak = 0
    for (let index = midStart; index < midStart + 80; index += 1) {
      midPeak = Math.max(midPeak, Math.abs(pcm.samples[index] ?? 0))
    }
    expect(midPeak).toBeGreaterThan(0.1)
    expect(pcm.samples[10]).toBe(0)
  })
})

describe('measureEnergyVadEdgeMetrics', () => {
  const hopAligned = createSilenceToneSilencePcm({
    sampleRateInHertz: 16_000,
    leadingSilenceMs: 320,
    speechMs: 800,
    trailingSilenceMs: 1920,
    frequencyInHertz: 200,
    amplitude: 0.4,
  })

  const metrics = measureEnergyVadEdgeMetrics(hopAligned)

  it('starts and ends on the labeled hops; auto-stop waits the next hop after hangover', () => {
    expect(metrics.startErrorMs).toBe(VAD_EDGE_MEASURED_START_ERROR_MS)
    expect(metrics.endErrorMs).toBe(VAD_EDGE_MEASURED_END_ERROR_MS)
    // 1100 ms is not a multiple of 16; first hop with silence >= hangover is +4 ms.
    expect(metrics.autoStopErrorVsHangoverMs).toBe(VAD_EDGE_MEASURED_HANGOVER_ERROR_MS)
    expect(metrics.autoStopMs).toBe(1120 + DEFAULT_VAD_SILENCE_HANGOVER_MS + 4)
  })

  it('detects speech start and end within one hop on a hard-gated tone', () => {
    expect(metrics.detectedSpeechStartMs).not.toBeNull()
    expect(metrics.detectedSpeechEndMs).not.toBeNull()
    expect(Math.abs(metrics.startErrorMs ?? 1_000)).toBeLessThanOrEqual(
      VAD_EDGE_MAX_ABS_START_ERROR_MS,
    )
    expect(Math.abs(metrics.endErrorMs ?? 1_000)).toBeLessThanOrEqual(
      VAD_EDGE_MAX_ABS_END_ERROR_MS,
    )
  })

  it('auto-stops at hangover ± one hop and keeps the default hangover', () => {
    expect(DEFAULT_VAD_SILENCE_HANGOVER_MS).toBe(1100)
    expect(DEFAULT_VAD_MINIMUM_SPEECH_MS).toBe(380)
    expect(metrics.autoStopMs).not.toBeNull()
    expect(Math.abs(metrics.autoStopErrorVsHangoverMs ?? 1_000)).toBeLessThanOrEqual(
      VAD_EDGE_MAX_ABS_HANGOVER_ERROR_MS,
    )
    expect(metrics.hopMs).toBe(VAD_EDGE_HOP_MS)
  })

  it('drops the trailing silence after hangover instead of sending it to ASR', () => {
    expect(metrics.trailingSilenceNotCapturedMs).toBe(816)
    expect(metrics.shareOfPostSpeechSilenceDropped).toBeCloseTo(0.425, 3)
  })
})
