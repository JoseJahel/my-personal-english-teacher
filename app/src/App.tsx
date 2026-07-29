import { shouldShowAsrBenchmarkScreen } from './app-routing'
import { AsrBenchmarkScreen } from './ui/AsrBenchmarkScreen'
import { HomeScreen } from './ui/HomeScreen'
import { useHomeScreenSession } from './ui/use-home-screen-session'

/** Wraps the home-screen session hook so App can branch before calling it. */
function HomeScreenContainer() {
  const homeScreenProps = useHomeScreenSession()
  return <HomeScreen {...homeScreenProps} />
}

/** Root shell: routes to the dev ASR benchmark screen or the real app. */
export function App() {
  if (shouldShowAsrBenchmarkScreen(import.meta.env.DEV, window.location.hash)) {
    return <AsrBenchmarkScreen />
  }

  return <HomeScreenContainer />
}

export default App
