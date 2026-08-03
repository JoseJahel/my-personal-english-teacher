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

  it('answers a bathroom question at the airport with restroom info, not wifi/cafe', () => {
    const reply = pickContextualTutorReply({
      scenario: airport,
      userUtteranceEn: 'Where is the bathroom?',
      userTurnIndex: 1,
    })
    expect(reply.toLowerCase()).toMatch(/restroom|bathroom/)
    expect(reply.toLowerCase()).not.toMatch(/wifi|cafe/)
  })

  it('still answers general airport amenities (wifi) without a bathroom keyword', () => {
    const reply = pickContextualTutorReply({
      scenario: airport,
      userUtteranceEn: 'Is there wifi here?',
      userTurnIndex: 1,
    })
    expect(reply.toLowerCase()).toMatch(/wifi/)
  })

  it('recognizes "delayed" (not just "delay") and keeps it on the delay topic', () => {
    const reply = pickContextualTutorReply({
      scenario: airport,
      userUtteranceEn: 'Is my flight delayed?',
      userTurnIndex: 0,
    })
    expect(reply.toLowerCase()).toMatch(/delay|expect|rebook/)
  })

  it('recognizes the plural "strengths", not just "strength"', () => {
    const reply = pickContextualTutorReply({
      scenario: interview,
      userUtteranceEn: 'What are your strengths?',
      userTurnIndex: 2,
    })
    expect(reply.toLowerCase()).toMatch(/honesty|goal/)
    expect(reply.toLowerCase()).not.toMatch(/good question|small product team/)
  })

  it('recognizes "allergies" (question form), not just the bare "allerg" stem', () => {
    const reply = pickContextualTutorReply({
      scenario: restaurant,
      userUtteranceEn: 'Do you have any allergies?',
      userTurnIndex: 1,
    })
    expect(reply.toLowerCase()).toMatch(/veggie salad|without meat/)
    expect(reply.toLowerCase()).not.toMatch(/happy to help|ready to order/)
  })

  it('recognizes "allergic", not just the bare "allerg" stem', () => {
    const reply = pickContextualTutorReply({
      scenario: restaurant,
      userUtteranceEn: "I'm allergic to nuts",
      userTurnIndex: 0,
    })
    expect(reply.toLowerCase()).toMatch(/veggie salad|without meat/)
    expect(reply.toLowerCase()).not.toMatch(/welcome|eat or drink/)
  })

  it('recognizes the plural "questions", not just "question"', () => {
    const reply = pickContextualTutorReply({
      scenario: interview,
      userUtteranceEn: 'Do you have any questions?',
      userTurnIndex: 1,
    })
    expect(reply.toLowerCase()).toMatch(/what would you like to know|role or the company/)
    expect(reply.toLowerCase()).not.toMatch(/good question|small product team/)
  })

  it('recognizes the plural "teams", not just "team"', () => {
    // Note: the coordinator's suggested phrase "Tell me about your team experience" was
    // swapped for this one — "experience" makes it match isBackgroundStatement earlier
    // in jobInterviewReply (the "why are you interested" branch), before the team check
    // ever runs, both before and after this fix. This phrasing isolates the team group.
    const reply = pickContextualTutorReply({
      scenario: interview,
      userUtteranceEn: 'I have worked on many teams',
      userTurnIndex: 0,
    })
    expect(reply.toLowerCase()).toMatch(/thanks for sharing|questions for us/)
    expect(reply.toLowerCase()).not.toMatch(/tell me your name/)
  })

  it('recognizes the plural "challenges", not just "challenge"', () => {
    const reply = pickContextualTutorReply({
      scenario: interview,
      userUtteranceEn: 'What challenges have you faced?',
      userTurnIndex: 1,
    })
    expect(reply.toLowerCase()).toMatch(/good example|work with other people/)
    expect(reply.toLowerCase()).not.toMatch(/good question|small product team/)
  })
})
