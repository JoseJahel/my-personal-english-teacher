import type { ReactNode } from 'react'
import { homeScreenInterfaceTexts } from './interface-texts'

export function OverlayView({
  testId,
  title,
  onBack,
  children,
}: {
  testId: string
  title: string
  onBack: () => void
  children: ReactNode
}) {
  const shell = homeScreenInterfaceTexts.shell
  return (
    <div
      className="absolute inset-0 z-20 overflow-y-auto bg-sage-50"
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="mx-auto max-w-3xl px-5 py-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h1 className="m-0 text-xl font-bold tracking-tight text-ink-900">{title}</h1>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-sage-200 bg-atelier-elev px-3 py-1.5 text-sm font-semibold text-ink-600 hover:border-sage-600 hover:text-ink-900"
          >
            {shell.backToPractice}
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
