import { shouldShowAsrBenchmarkScreen, shouldShowShellPreviewScreen } from './app-routing'
import { AsrBenchmarkScreen } from './ui/AsrBenchmarkScreen'
import { HomeScreen } from './ui/HomeScreen'
import { ShellPreviewScreen } from './ui/ShellPreviewScreen'
import { resolveShellPreviewVariant } from './ui/shell-preview-fixture'
import { useHomeScreenSession } from './ui/use-home-screen-session'

/** Wraps the home-screen session hook so App can branch before calling it. */
function HomeScreenContainer() {
  const homeScreenProps = useHomeScreenSession()
  return <HomeScreen {...homeScreenProps} />
}

/** Root shell: routes to dev tools or the real practice app. */
export function App() {
  const isDev = import.meta.env.DEV
  const hash = window.location.hash

  if (shouldShowAsrBenchmarkScreen(isDev, hash)) {
    return <AsrBenchmarkScreen />
  }

  if (shouldShowShellPreviewScreen(isDev, hash)) {
    const variant = resolveShellPreviewVariant(hash) ?? 'idle'
    return <ShellPreviewScreen variant={variant} />
  }

  return <HomeScreenContainer />
}

export default App
