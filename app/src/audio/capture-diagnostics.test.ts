import { describe, expect, it } from 'vitest'
import { buildCaptureDiagnostics, type CaptureAudioSource } from './capture-diagnostics'

function baseParams(overrides: Partial<Parameters<typeof buildCaptureDiagnostics>[0]> = {}) {
  return {
    samples: new Float32Array([0.5, -0.5, 0.5, -0.5]),
    sampleRate: 16000,
    deviceLabel: 'Built-in Microphone',
    source: 'media-recorder' as CaptureAudioSource,
    mediaRecorderBlobBytes: 4096,
    trackReadyState: 'live',
    trackMuted: false,
    audioContextState: 'running',
    ...overrides,
  }
}

describe('buildCaptureDiagnostics', () => {
  it('computes sampleCount and durationSeconds from samples and sampleRate', () => {
    const samples = new Float32Array(1600) // 0.1s at 16kHz
    const diagnostics = buildCaptureDiagnostics(baseParams({ samples, sampleRate: 16000 }))
    expect(diagnostics.sampleCount).toBe(1600)
    expect(diagnostics.durationSeconds).toBeCloseTo(0.1, 6)
  })

  it('computes rmsEnergy and peakAmplitude for a known constant-amplitude signal', () => {
    const samples = new Float32Array([1, -1, 1, -1])
    const diagnostics = buildCaptureDiagnostics(baseParams({ samples }))
    expect(diagnostics.rmsEnergy).toBeCloseTo(1, 6)
    expect(diagnostics.peakAmplitude).toBeCloseTo(1, 6)
  })

  it('returns zero energy and zero duration for empty samples', () => {
    const diagnostics = buildCaptureDiagnostics(baseParams({ samples: new Float32Array(0) }))
    expect(diagnostics.sampleCount).toBe(0)
    expect(diagnostics.durationSeconds).toBe(0)
    expect(diagnostics.rmsEnergy).toBe(0)
    expect(diagnostics.peakAmplitude).toBe(0)
  })

  it('falls back to a safe rate of 1 Hz when sampleRate is zero, avoiding division by zero', () => {
    const samples = new Float32Array([0.1, 0.2, 0.3])
    const diagnostics = buildCaptureDiagnostics(baseParams({ samples, sampleRate: 0 }))
    expect(Number.isFinite(diagnostics.durationSeconds)).toBe(true)
    expect(diagnostics.durationSeconds).toBe(samples.length)
  })

  it('falls back to a safe rate of 1 Hz when sampleRate is negative', () => {
    const samples = new Float32Array([0.1, 0.2, 0.3, 0.4])
    const diagnostics = buildCaptureDiagnostics(baseParams({ samples, sampleRate: -16000 }))
    expect(Number.isFinite(diagnostics.durationSeconds)).toBe(true)
    expect(diagnostics.durationSeconds).toBe(samples.length)
  })

  it('passes device and track metadata through unchanged', () => {
    const diagnostics = buildCaptureDiagnostics(
      baseParams({
        deviceLabel: 'USB Microphone',
        source: 'none',
        mediaRecorderBlobBytes: 0,
        trackReadyState: 'ended',
        trackMuted: true,
        audioContextState: 'suspended',
      }),
    )
    expect(diagnostics.deviceLabel).toBe('USB Microphone')
    expect(diagnostics.source).toBe('none')
    expect(diagnostics.mediaRecorderBlobBytes).toBe(0)
    expect(diagnostics.trackReadyState).toBe('ended')
    expect(diagnostics.trackMuted).toBe(true)
    expect(diagnostics.audioContextState).toBe('suspended')
  })
})
