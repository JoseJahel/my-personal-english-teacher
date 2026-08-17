import { useEffect, useState } from 'react'
import {
  resolvePracticeMockAccess,
  readPracticeMockSkipFlag,
  shouldShowAsrBenchmarkScreen,
  shouldShowPracticeMockScreen,
  shouldShowShellPreviewScreen,
  writePracticeMockSkipFlag,
} from './app-routing'
import { AsrBenchmarkScreen } from './ui/AsrBenchmarkScreen'
import { HomeScreen } from './ui/HomeScreen'
import { homeScreenInterfaceTexts } from './ui/interface-texts'
import { createMockHomeSessionPorts } from './ui/mock-home-session-ports'
import { PRACTICE_SHELL_TEST_IDS } from './ui/practice-shell-types'
import { ShellPreviewScreen } from './ui/ShellPreviewScreen'
import { resolveShellPreviewVariant } from './ui/shell-preview-fixture'
import { useHomeScreenSession } from './ui/use-home-screen-session'

function useWindowHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const syncHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])
  return hash
}

function leavePracticeMockPermanently(onSkipStored: () => void): void {
  writePracticeMockSkipFlag(true)
  onSkipStored()
  if (window.location.hash.length > 0) {
    window.location.hash = ''
  }
}

/** Wraps the home-screen session hook so App can branch before calling it. */
function HomeScreenContainer() {
  const homeScreenProps = useHomeScreenSession()
  return <HomeScreen {...homeScreenProps} />
}

function PracticeMockGate(props: {
  readonly onChooseReal: () => void
  readonly onConfirmEnsayo: () => void
}) {
  const copy = homeScreenInterfaceTexts
  return (
    <div
      className="flex h-full min-h-0 items-center justify-center bg-sage-50 px-6"
      data-testid={PRACTICE_SHELL_TEST_IDS.practiceMockGate}
    >
      <div className="max-w-lg rounded-2xl bg-atelier-elev p-6 text-center shadow-sm ring-1 ring-sage-200">
        <h1 className="m-0 font-serif text-2xl text-ink-900">{copy.practiceMockGateTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{copy.practiceMockGateBody}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            data-testid={PRACTICE_SHELL_TEST_IDS.practiceMockGateReal}
            onClick={props.onChooseReal}
            className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sage-700"
          >
            {copy.practiceMockGateRealLabel}
          </button>
          <button
            type="button"
            data-testid={PRACTICE_SHELL_TEST_IDS.practiceMockGateEnter}
            onClick={props.onConfirmEnsayo}
            className="rounded-lg border border-sage-200 bg-sage-50 px-4 py-2 text-sm font-semibold text-ink-600 hover:border-sage-600"
          >
            {copy.practiceMockGateEnterLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** DEV only: same HomeScreen, restaurant mocks, no mic / no 1 GB models. */
function PracticeMockHomeScreen(props: { readonly onLeavePermanently: () => void }) {
  const homeScreenProps = useHomeScreenSession(createMockHomeSessionPorts())
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 flex-wrap items-center justify-center gap-3 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 ring-1 ring-amber-200"
        data-testid={PRACTICE_SHELL_TEST_IDS.practiceMockBanner}
        role="status"
      >
        <p className="m-0 max-w-3xl">{homeScreenInterfaceTexts.practiceMockBanner}</p>
        <button
          type="button"
          data-testid={PRACTICE_SHELL_TEST_IDS.practiceMockExit}
          onClick={props.onLeavePermanently}
          className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-sage-50 hover:bg-ink-600"
        >
          {homeScreenInterfaceTexts.practiceMockExitLabel}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <HomeScreen {...homeScreenProps} />
      </div>
    </div>
  )
}

/** Root shell: routes to dev tools or the real practice app. */
export function App() {
  const isDev = import.meta.env.DEV
  const ensayoUiFlag = import.meta.env.VITE_ENSAYO_UI
  const hash = useWindowHash()
  const [skipStored, setSkipStored] = useState(() => readPracticeMockSkipFlag())
  const [sessionConfirmed, setSessionConfirmed] = useState(false)

  const mockAccess = resolvePracticeMockAccess({
    isDev,
    hash,
    search: window.location.search,
    skipStored,
    sessionConfirmed,
    ensayoUiFlag,
  })

  useEffect(() => {
    if (shouldShowPracticeMockScreen(isDev, hash, ensayoUiFlag) && mockAccess === 'off') {
      window.location.hash = ''
    }
  }, [ensayoUiFlag, hash, isDev, mockAccess])

  if (shouldShowAsrBenchmarkScreen(isDev, hash)) {
    return <AsrBenchmarkScreen />
  }

  if (shouldShowShellPreviewScreen(isDev, hash)) {
    const variant = resolveShellPreviewVariant(hash) ?? 'idle'
    return <ShellPreviewScreen variant={variant} />
  }

  if (mockAccess === 'gate') {
    return (
      <PracticeMockGate
        onChooseReal={() => leavePracticeMockPermanently(() => setSkipStored(true))}
        onConfirmEnsayo={() => setSessionConfirmed(true)}
      />
    )
  }

  if (mockAccess === 'session') {
    return (
      <PracticeMockHomeScreen
        onLeavePermanently={() => leavePracticeMockPermanently(() => setSkipStored(true))}
      />
    )
  }

  return <HomeScreenContainer />
}

export default App
