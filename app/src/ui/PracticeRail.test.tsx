import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PracticeRail } from './PracticeRail'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'
import { homeScreenInterfaceTexts } from './interface-texts'

describe('PracticeRail study nav', () => {
  let root: ReturnType<typeof createRoot> | null = null
  let host: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    host.remove()
    root = null
  })

  it('shows Estudio and reports study on click', () => {
    const onNavigate = vi.fn()
    act(() => {
      root?.render(
        <PracticeRail
          activeView="practice"
          practiceMode="conversation"
          selectedScenarioId="restaurant"
          isScenarioSelectionLocked={false}
          firstTurnHintEn=""
          offlineCompactMessage=""
          isFullyOfflineReady={false}
          asrDemoProfile="precision"
          onNavigate={onNavigate}
          onSelectScenario={() => undefined}
          onSelectMode={() => undefined}
        />,
      )
    })
    const studyButton = host.querySelector(
      `[data-testid="${PRACTICE_SHELL_TEST_IDS.railNavStudy}"]`,
    ) as HTMLButtonElement | null
    expect(studyButton).not.toBeNull()
    expect(studyButton?.textContent).toContain(homeScreenInterfaceTexts.shell.navStudy)
    act(() => {
      studyButton?.click()
    })
    expect(onNavigate).toHaveBeenCalledWith('study')
  })
})
