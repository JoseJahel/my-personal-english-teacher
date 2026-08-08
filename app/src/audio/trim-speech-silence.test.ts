import { describe, expect, it } from 'vitest'
import { trimSpeechSilence } from './trim-speech-silence'
describe('trimSpeechSilence', () => {
  it('returns empty for empty input', () => {
    expect(trimSpeechSilence(new Float32Array(0), 16000).length).toBe(0)
  })
  it('trims long leading and trailing silence around speech', () => {
    const sampleRate = 16000
    const lead = new Float32Array(sampleRate * 0.5)
    const speech = new Float32Array(sampleRate * 0.4).fill(0.2)
    const trail = new Float32Array(sampleRate * 0.6)
    const full = new Float32Array(lead.length + speech.length + trail.length)
    full.set(lead, 0)
    full.set(speech, lead.length)
    full.set(trail, lead.length + speech.length)
    const trimmed = trimSpeechSilence(full, sampleRate)
    expect(trimmed.length).toBeLessThan(full.length * 0.7)
    expect(trimmed.length).toBeGreaterThan(speech.length * 0.8)
    expect(Math.max(...Array.from(trimmed).map(Math.abs))).toBeCloseTo(0.2, 5)
  })
  it('keeps the full buffer when everything is speech-like', () => {
    const speech = new Float32Array(8000).fill(0.15)
    const trimmed = trimSpeechSilence(speech, 16000)
    expect(trimmed.length).toBe(speech.length)
  })
  it('returns a copy when no speech frames exist (near silence)', () => {
    const hush = new Float32Array(16000).fill(0.0005)
    const trimmed = trimSpeechSilence(hush, 16000)
    expect(trimmed.length).toBe(hush.length)
    expect(Math.max(...Array.from(trimmed).map(Math.abs))).toBeCloseTo(0.0005, 5)
  })
  it('sanitizes NaN and Infinity samples instead of letting them reach the output', () => {
    const speech = new Float32Array(8000).fill(0.15)
    speech[10] = NaN
    speech[20] = Infinity
    speech[30] = -Infinity
    const trimmed = trimSpeechSilence(speech, 16000)
    expect(trimmed.every((value) => Number.isFinite(value))).toBe(true)
    expect(trimmed[10]).toBe(0)
    expect(trimmed[20]).toBe(0)
    expect(trimmed[30]).toBe(0)
  })
})
