import { homeScreenInterfaceTexts } from './ui/interface-texts'

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center text-slate-800">
      <span className="rounded-full border border-slate-300 bg-white px-4 py-1 text-sm font-medium text-slate-600 shadow-sm">
        {homeScreenInterfaceTexts.projectPhaseBadgeLabel}
      </span>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        {homeScreenInterfaceTexts.applicationTitle}
      </h1>
      <p className="max-w-xl text-lg text-slate-600">
        {homeScreenInterfaceTexts.applicationSubtitle}
      </p>
    </main>
  )
}

export default App
