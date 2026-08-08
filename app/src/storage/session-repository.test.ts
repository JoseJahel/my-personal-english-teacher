import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createPracticeSessionRepository } from './session-repository'
import type { PracticeSessionRepository } from './session-repository'
import type { CreatePracticeTurnInput } from './practice-session-types'

/**
 * Each test gets a fresh isolated IDBFactory injected into the repository,
 * so no global patching and no teardown between tests.
 *
 * Only `Date` is faked: fake-indexeddb dispatches transaction events through
 * real timers, so faking all of them would deadlock every request. Session and
 * turn ordering is derived from millisecond ISO timestamps, and records written
 * within the same millisecond tie on the index key — the tie is then broken by
 * the random UUID primary key. Controlling the clock keeps ordering assertions
 * deterministic.
 */

const BASE_TIME_MS = Date.UTC(2026, 7, 7, 10, 0, 0)

function advanceClockTo(offsetMs: number): void {
  vi.setSystemTime(new Date(BASE_TIME_MS + offsetMs))
}

function createTurnInput(
  sessionId: string,
  overrides: Partial<CreatePracticeTurnInput> = {},
): CreatePracticeTurnInput {
  return {
    sessionId,
    scenarioId: 'restaurant',
    transcribedText: 'i want a table for two',
    correctedText: 'I want a table for two.',
    tutorReplyText: 'Of course, do you have a reservation?',
    tutorUsedFallback: false,
    pronunciationScore0to100: 82,
    mfccScore0to100: 79,
    pitchScore0to100: 88,
    formantF1InHertz: 520,
    formantF2InHertz: 1620,
    formantF3InHertz: 2540,
    wordHighlights: [
      { word: 'I', score0to100: 91, band: 'good' },
      { word: 'want', score0to100: 58, band: 'medium' },
    ],
    ...overrides,
  }
}

describe('createPracticeSessionRepository', () => {
  let repository: PracticeSessionRepository

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    advanceClockTo(0)
    repository = await createPracticeSessionRepository(new IDBFactory())
  })

  afterEach(() => {
    repository.close()
    vi.useRealTimers()
  })

  describe('ensureSessionForScenario', () => {
    it('creates a session when the database is empty', async () => {
      const session = await repository.ensureSessionForScenario('restaurant')

      expect(session.scenarioId).toBe('restaurant')
      expect(session.id).toMatch(/^session-/)
      expect(session.createdAtIso).toBe(session.updatedAtIso)
    })

    it('reuses the latest session when the scenario matches', async () => {
      const first = await repository.ensureSessionForScenario('airport')
      advanceClockTo(1_000)
      const second = await repository.ensureSessionForScenario('airport')

      expect(second.id).toBe(first.id)
      expect(second.createdAtIso).toBe(first.createdAtIso)
    })

    it('creates a new session when the scenario changes', async () => {
      const restaurant = await repository.ensureSessionForScenario('restaurant')
      advanceClockTo(1_000)
      const jobInterview = await repository.ensureSessionForScenario('job-interview')

      expect(jobInterview.id).not.toBe(restaurant.id)
      expect(jobInterview.scenarioId).toBe('job-interview')
    })

    it('reuses the most recent session after switching scenarios back and forth', async () => {
      await repository.ensureSessionForScenario('restaurant')
      advanceClockTo(1_000)
      const airport = await repository.ensureSessionForScenario('airport')
      advanceClockTo(2_000)
      const airportAgain = await repository.ensureSessionForScenario('airport')

      expect(airportAgain.id).toBe(airport.id)
    })
  })

  describe('saveTurn', () => {
    it('persists a turn with trimmed text and a word highlight summary', async () => {
      const session = await repository.ensureSessionForScenario('restaurant')

      const turn = await repository.saveTurn(
        createTurnInput(session.id, {
          transcribedText: '  i want a table  ',
          correctedText: '  I want a table.  ',
          tutorReplyText: '  Sure.  ',
        }),
      )

      expect(turn.id).toMatch(/^turn-/)
      expect(turn.sessionId).toBe(session.id)
      expect(turn.transcribedText).toBe('i want a table')
      expect(turn.correctedText).toBe('I want a table.')
      expect(turn.tutorReplyText).toBe('Sure.')
      expect(turn.wordHighlightSummary).toBe('I:good want:medium')
    })

    it('stores the acoustic metrics and the fallback flag verbatim', async () => {
      const session = await repository.ensureSessionForScenario('restaurant')

      const turn = await repository.saveTurn(
        createTurnInput(session.id, {
          tutorUsedFallback: true,
          pronunciationScore0to100: null,
          mfccScore0to100: null,
          pitchScore0to100: null,
          formantF1InHertz: 640,
        }),
      )

      expect(turn.tutorUsedFallback).toBe(true)
      expect(turn.pronunciationScore0to100).toBeNull()
      expect(turn.mfccScore0to100).toBeNull()
      expect(turn.pitchScore0to100).toBeNull()
      expect(turn.formantF1InHertz).toBe(640)
    })

    it('propagates the turn timestamp to the parent session', async () => {
      const session = await repository.ensureSessionForScenario('restaurant')
      advanceClockTo(5_000)
      const turn = await repository.saveTurn(createTurnInput(session.id))

      advanceClockTo(6_000)
      const reused = await repository.ensureSessionForScenario('restaurant')

      expect(reused.id).toBe(session.id)
      expect(reused.updatedAtIso).toBe(turn.createdAtIso)
      expect(reused.updatedAtIso).not.toBe(session.updatedAtIso)
    })

    it('still stores the turn when the parent session does not exist', async () => {
      const turn = await repository.saveTurn(createTurnInput('session-missing'))

      const stored = await repository.listTurnsForSession('session-missing')
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe(turn.id)
    })
  })

  describe('listRecentTurns', () => {
    it('returns an empty list when nothing has been stored', async () => {
      await expect(repository.listRecentTurns()).resolves.toEqual([])
    })

    it('returns turns newest first', async () => {
      const session = await repository.ensureSessionForScenario('restaurant')

      advanceClockTo(1_000)
      const oldest = await repository.saveTurn(
        createTurnInput(session.id, { transcribedText: 'first' }),
      )
      advanceClockTo(2_000)
      const middle = await repository.saveTurn(
        createTurnInput(session.id, { transcribedText: 'second' }),
      )
      advanceClockTo(3_000)
      const newest = await repository.saveTurn(
        createTurnInput(session.id, { transcribedText: 'third' }),
      )

      const recent = await repository.listRecentTurns()

      expect(recent.map((turn) => turn.id)).toEqual([newest.id, middle.id, oldest.id])
    })

    it('honours an explicit limit and keeps the newest turns', async () => {
      const session = await repository.ensureSessionForScenario('restaurant')

      advanceClockTo(1_000)
      await repository.saveTurn(createTurnInput(session.id, { transcribedText: 'first' }))
      advanceClockTo(2_000)
      const middle = await repository.saveTurn(
        createTurnInput(session.id, { transcribedText: 'second' }),
      )
      advanceClockTo(3_000)
      const newest = await repository.saveTurn(
        createTurnInput(session.id, { transcribedText: 'third' }),
      )

      const recent = await repository.listRecentTurns(2)

      expect(recent.map((turn) => turn.id)).toEqual([newest.id, middle.id])
    })

    it('returns every turn when there are fewer than the default limit', async () => {
      const session = await repository.ensureSessionForScenario('restaurant')

      advanceClockTo(1_000)
      await repository.saveTurn(createTurnInput(session.id))
      advanceClockTo(2_000)
      await repository.saveTurn(createTurnInput(session.id))

      await expect(repository.listRecentTurns()).resolves.toHaveLength(2)
    })

    it('spans sessions, since the history panel is not scoped to one scenario', async () => {
      const restaurant = await repository.ensureSessionForScenario('restaurant')
      advanceClockTo(1_000)
      await repository.saveTurn(createTurnInput(restaurant.id))

      advanceClockTo(2_000)
      const airport = await repository.ensureSessionForScenario('airport')
      advanceClockTo(3_000)
      await repository.saveTurn(createTurnInput(airport.id, { scenarioId: 'airport' }))

      const recent = await repository.listRecentTurns()

      expect(recent).toHaveLength(2)
      expect(recent.map((turn) => turn.scenarioId)).toEqual(['airport', 'restaurant'])
    })
  })

  describe('listTurnsForSession', () => {
    it('returns only the turns belonging to the requested session', async () => {
      const restaurant = await repository.ensureSessionForScenario('restaurant')
      advanceClockTo(1_000)
      const restaurantTurn = await repository.saveTurn(createTurnInput(restaurant.id))

      advanceClockTo(2_000)
      const airport = await repository.ensureSessionForScenario('airport')
      advanceClockTo(3_000)
      await repository.saveTurn(createTurnInput(airport.id, { scenarioId: 'airport' }))

      const turns = await repository.listTurnsForSession(restaurant.id)

      expect(turns).toHaveLength(1)
      expect(turns[0].id).toBe(restaurantTurn.id)
    })

    it('returns an empty list for an unknown session id', async () => {
      await expect(repository.listTurnsForSession('session-unknown')).resolves.toEqual([])
    })
  })

  describe('close', () => {
    it('rejects reads issued after the database is closed', async () => {
      repository.close()

      await expect(repository.listRecentTurns()).rejects.toThrow()
    })

    it('rejects writes issued after the database is closed', async () => {
      const session = await repository.ensureSessionForScenario('restaurant')
      repository.close()

      await expect(repository.saveTurn(createTurnInput(session.id))).rejects.toThrow()
    })
  })
})
