import { describe, expect, it } from 'vitest'
import { createEnergyVoiceActivityDetector } from './voice-activity-detection'

const SPEECH = { rms: 0.05, peak: 0.1 }
const SILENCE = { rms: 0.0001, peak: 0.0001 }

describe('createEnergyVoiceActivityDetector', () => {
  it('stays waiting while only silence is observed', () => {
    const vad = createEnergyVoiceActivityDetector({
      minimumSpeechMs: 400,
      silenceHangoverMs: 800,
    })
    const result = vad.pushFrame(SILENCE, 0)
    expect(result.state).toBe('waiting-for-speech')
    expect(result.shouldAutoStop).toBe(false)
    expect(result.hasHeardSpeech).toBe(false)
  })

  it('does not auto-stop on silence before any speech', () => {
    const vad = createEnergyVoiceActivityDetector({
      minimumSpeechMs: 200,
      silenceHangoverMs: 100,
    })
    expect(vad.pushFrame(SILENCE, 0).shouldAutoStop).toBe(false)
    expect(vad.pushFrame(SILENCE, 500).shouldAutoStop).toBe(false)
  })

  it('auto-stops after speech then hangover silence', () => {
    const vad = createEnergyVoiceActivityDetector({
      minimumSpeechMs: 300,
      silenceHangoverMs: 500,
      maximumUtteranceMs: 60_000,
    })

    // Speech for 400 ms
    expect(vad.pushFrame(SPEECH, 0).state).toBe('in-speech')
    expect(vad.pushFrame(SPEECH, 200).hasHeardSpeech).toBe(true)
    const mid = vad.pushFrame(SPEECH, 400)
    expect(mid.shouldAutoStop).toBe(false)

    // Trailing silence starts at t=400
    const earlySilence = vad.pushFrame(SILENCE, 400)
    expect(earlySilence.state).toBe('trailing-silence')
    expect(earlySilence.shouldAutoStop).toBe(false)

    const stop = vad.pushFrame(SILENCE, 400 + 500)
    expect(stop.shouldAutoStop).toBe(true)
    // Only once
    expect(vad.pushFrame(SILENCE, 400 + 600).shouldAutoStop).toBe(false)
  })

  it('requires minimum speech duration before hangover can fire', () => {
    const vad = createEnergyVoiceActivityDetector({
      minimumSpeechMs: 500,
      silenceHangoverMs: 200,
    })
    vad.pushFrame(SPEECH, 0)
    // Only 100 ms of speech then long silence — should not stop yet.
    expect(vad.pushFrame(SILENCE, 100).shouldAutoStop).toBe(false)
    expect(vad.pushFrame(SILENCE, 100 + 300).shouldAutoStop).toBe(false)
  })

  it('auto-stops at maximum utterance duration even while speaking', () => {
    const vad = createEnergyVoiceActivityDetector({
      minimumSpeechMs: 100,
      silenceHangoverMs: 10_000,
      maximumUtteranceMs: 1000,
    })
    vad.pushFrame(SPEECH, 0)
    expect(vad.pushFrame(SPEECH, 999).shouldAutoStop).toBe(false)
    expect(vad.pushFrame(SPEECH, 1000).shouldAutoStop).toBe(true)
  })

  it('reset clears history', () => {
    const vad = createEnergyVoiceActivityDetector({
      minimumSpeechMs: 100,
      silenceHangoverMs: 100,
    })
    vad.pushFrame(SPEECH, 0)
    vad.pushFrame(SILENCE, 200)
    expect(vad.pushFrame(SILENCE, 300).shouldAutoStop).toBe(true)
    vad.reset()
    expect(vad.getState()).toBe('waiting-for-speech')
    expect(vad.pushFrame(SILENCE, 400).shouldAutoStop).toBe(false)
  })
})
