import { HomeScreen } from './ui/HomeScreen'
import { useHomeScreenSession } from './ui/use-home-screen-session'

/** Root shell: wires the home-screen session hook into pure presentation. */
export function App() {
  const homeScreenProps = useHomeScreenSession()
  return <HomeScreen {...homeScreenProps} />
}

export default App
