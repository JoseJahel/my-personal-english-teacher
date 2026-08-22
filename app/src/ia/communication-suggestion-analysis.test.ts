import { describe, expect, it } from 'vitest'
import { analyzePracticeUtterance } from './communication-suggestion-analysis'

describe('analyzePracticeUtterance', () => {
  it('treats a restaurant want-phrase as an order and keeps the complement', () => {
    const analysis = analyzePracticeUtterance({
      scenarioId: 'restaurant',
      userUtteranceEn: 'I want a coffee',
      correctedUtteranceEn: 'I want a coffee',
    })
    expect(analysis.intent).toBe('order')
    expect(analysis.complement).toMatch(/coffee/i)
    expect(analysis.hasPoliteModal).toBe(false)
  })

  it('treats a one-word restaurant question as an order for that item', () => {
    const analysis = analyzePracticeUtterance({
      scenarioId: 'restaurant',
      userUtteranceEn: 'Water?',
      correctedUtteranceEn: 'Water?',
    })
    expect(analysis.intent).toBe('order')
    expect(analysis.isShort).toBe(true)
  })

  it('detects interview experience and the topic after with', () => {
    const analysis = analyzePracticeUtterance({
      scenarioId: 'job-interview',
      userUtteranceEn: 'I have experience with teams',
      correctedUtteranceEn: 'I have experience with teams.',
    })
    expect(analysis.intent).toBe('experience')
    expect(analysis.complement).toMatch(/teams/i)
  })

  it('ignores a comma-only grammar fix when choosing the display sentence', () => {
    const analysis = analyzePracticeUtterance({
      scenarioId: 'restaurant',
      userUtteranceEn: 'I would like a glass of water please',
      correctedUtteranceEn: 'I would like a glass of water, please.',
    })
    expect(analysis.hasPoliteModal).toBe(true)
    expect(analysis.complement).toMatch(/glass of water/i)
    expect(analysis.substitutions).toEqual([])
  })
})
