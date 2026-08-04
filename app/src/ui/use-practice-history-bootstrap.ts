/**
 * Boots IndexedDB practice repository and loads recent turns once.
 */

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import {
  createPracticeSessionRepository,
  type PracticeSessionRepository,
} from '../storage/session-repository'
import { homeScreenInterfaceTexts } from './interface-texts'
import type { PracticeScenarioId } from './practice-scenarios'

export function usePracticeHistoryBootstrap(input: {
  readonly practiceRepositoryRef: MutableRefObject<PracticeSessionRepository | null>
  readonly activeSessionIdRef: MutableRefObject<string | null>
  readonly selectedScenarioIdRef: MutableRefObject<PracticeScenarioId>
  readonly setPracticeHistoryTurns: Dispatch<SetStateAction<PracticeTurnRecord[]>>
  readonly setPracticeHistoryStatusMessage: Dispatch<SetStateAction<string>>
}): void {
  const {
    practiceRepositoryRef,
    activeSessionIdRef,
    selectedScenarioIdRef,
    setPracticeHistoryTurns,
    setPracticeHistoryStatusMessage,
  } = input

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!globalThis.indexedDB) {
          setPracticeHistoryStatusMessage(
            homeScreenInterfaceTexts.practiceHistory.statusUnavailable,
          )
          return
        }
        const repository = await createPracticeSessionRepository()
        if (cancelled) {
          repository.close()
          return
        }
        practiceRepositoryRef.current = repository
        const session = await repository.ensureSessionForScenario(selectedScenarioIdRef.current)
        activeSessionIdRef.current = session.id
        const turns = await repository.listRecentTurns(10)
        if (!cancelled) {
          setPracticeHistoryTurns(turns)
          setPracticeHistoryStatusMessage(homeScreenInterfaceTexts.practiceHistory.statusReady)
        }
      } catch (error) {
        console.warn('Practice IndexedDB init failed.', error)
        if (!cancelled) {
          setPracticeHistoryStatusMessage(
            homeScreenInterfaceTexts.practiceHistory.statusUnavailable,
          )
        }
      }
    })()

    return () => {
      cancelled = true
      practiceRepositoryRef.current?.close()
      practiceRepositoryRef.current = null
    }
  }, [
    activeSessionIdRef,
    practiceRepositoryRef,
    selectedScenarioIdRef,
    setPracticeHistoryStatusMessage,
    setPracticeHistoryTurns,
  ])
}
