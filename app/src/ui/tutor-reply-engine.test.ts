import { describe, expect, it } from 'vitest'
import { getPracticeScenarioById } from './practice-scenarios'
import { pickContextualTutorReply } from './tutor-reply-engine'

describe('pickContextualTutorReply', () => {
  const restaurant = getPracticeScenarioById('restaurant')
  const airport = getPracticeScenarioById('airport')
  const interview = getPracticeScenarioById('job-interview')

  it('does not answer a name question with an order upsell only', () => {
    const reply = pickContextualTutorReply({
      scenario: restaurant,
      userUtteranceEn: "Hello, what's your name?",
      userTurnIndex: 0,
    })
    expect(reply.toLowerCase()).toMatch(/alex|waiter/)
    expect(reply.toLowerCase()).not.toMatch(/boarding pass/)
  })

  it('reacts to a food order with a drink offer and echoes the dish', () => {
    const reply = pickContextualTutorReply({
      scenario: restaurant,
      userUtteranceEn: 'I would like the grilled chicken, please.',
      userTurnIndex: 0,
    })
    expect(reply.toLowerCase()).toMatch(/chicken/)
    expect(reply.toLowerCase()).toMatch(/drink|great choice/)
  })

  it('echoes both food and drink when ordered together', () => {
    const reply = pickContextualTutorReply({
      scenario: restaurant,
      userUtteranceEn: 'Can I have pasta and water?',
      userTurnIndex: 1,
    })
    expect(reply.toLowerCase()).toMatch(/pasta/)
    expect(reply.toLowerCase()).toMatch(/water/)
  })

  it('keeps airport replies on airport topics', () => {
    const reply = pickContextualTutorReply({
      scenario: airport,
      userUtteranceEn: 'Where is my gate?',
      userTurnIndex: 0,
    })
    expect(reply.toLowerCase()).toMatch(/gate|board/)
  })

  it('handles bill requests in the restaurant', () => {
    const reply = pickContextualTutorReply({
      scenario: restaurant,
      userUtteranceEn: 'Can I have the bill, please?',
      userTurnIndex: 2,
    })
    expect(reply.toLowerCase()).toMatch(/bill/)
  })

  it('asks to clarify on unclear short ASR garbage', () => {
    const reply = pickContextualTutorReply({
      scenario: restaurant,
      userUtteranceEn: 'uh',
      userTurnIndex: 0,
    })
    expect(reply.toLowerCase()).toMatch(/catch|again|order/)
  })

  it('does not treat bare "I am ready" as a full job introduction', () => {
    const reply = pickContextualTutorReply({
      scenario: interview,
      userUtteranceEn: 'I am ready.',
      userTurnIndex: 0,
    })
    // Should re-prompt for intro, not jump to "why interested" from weak match.
    expect(reply.toLowerCase()).toMatch(/introduce|name|background|catch/)
  })

  it('accepts a real self-introduction in the interview', () => {
    const reply = pickContextualTutorReply({
      scenario: interview,
      userUtteranceEn: 'My name is Ana and I am a software engineer.',
      userTurnIndex: 0,
    })
    expect(reply.toLowerCase()).toMatch(/interested|role/)
  })

  it('handles seat requests at the airport', () => {
    const reply = pickContextualTutorReply({
      scenario: airport,
      userUtteranceEn: 'Can I get a window seat please?',
      userTurnIndex: 1,
    })
    expect(reply.toLowerCase()).toMatch(/window|seat/)
  })
})
