import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MOCK_RESTAURANT_GRAMMAR_EN,
  MOCK_RESTAURANT_TRANSCRIPT_EN,
  MOCK_RESTAURANT_TUTOR_REPLY_EN,
  createMockHomeSessionPorts,
  createUsableMockSpeechPcm,
} from './mock-home-session-ports'
import { hasUsableSpeechEnergy } from '../dsp/signal-energy'

describe('createMockHomeSessionPorts', () => {
  it('does not import Hugging Face transformers', () => {
    const sourcePath = join(dirname(fileURLToPath(import.meta.url)), 'mock-home-session-ports.ts')
    const source = readFileSync(sourcePath, 'utf8')
    expect(source).not.toMatch(/from ['"]@huggingface\/transformers['"]/)
    expect(source).not.toMatch(/navigator\.mediaDevices/)
  })

  it('returns restaurant texts and usable speech without a worker', async () => {
    const ports = createMockHomeSessionPorts()
    const client = ports.createInferenceClient()
    const session = await ports.startSpeechCapture()
    const captured = await session.stop()

    expect(hasUsableSpeechEnergy(captured.samples, captured.sampleRate)).toBe(true)
    expect(await client.transcribe(createUsableMockSpeechPcm())).toBe(
      MOCK_RESTAURANT_TRANSCRIPT_EN,
    )
    expect(await client.correctGrammar(MOCK_RESTAURANT_TRANSCRIPT_EN)).toBe(
      MOCK_RESTAURANT_GRAMMAR_EN,
    )
    expect(
      (
        await client.generateTutorReply({
          scenarioContextEn: 'restaurant',
          historyTurnsEn: [],
          userUtteranceEn: MOCK_RESTAURANT_TRANSCRIPT_EN,
          fallbackReplyEn: 'fallback',
        })
      ).tutorReplyText,
    ).toBe(MOCK_RESTAURANT_TUTOR_REPLY_EN)
    const speech = await client.synthesizeSpeech(MOCK_RESTAURANT_TUTOR_REPLY_EN)
    expect(speech.samples.length).toBeGreaterThan(0)
    client.dispose()
  })

  it('fills the mock analyser with a moving wave, not a flat line', async () => {
    const ports = createMockHomeSessionPorts()
    const session = await ports.startSpeechCapture()
    const buffer = new Float32Array(session.analyserNode.fftSize)
    session.analyserNode.getFloatTimeDomainData(buffer)
    const unique = new Set(Array.from(buffer, (sample) => sample.toFixed(5)))
    expect(unique.size).toBeGreaterThan(8)
    session.abort()
  })
})
