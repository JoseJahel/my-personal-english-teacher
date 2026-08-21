import type { ReactNode } from 'react'

export function PanelTab({
  testId,
  label,
  isActive,
  onClick,
}: {
  testId: string
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      data-testid={testId}
      aria-selected={isActive}
      onClick={onClick}
      className={`mb-[-1px] flex-1 border-b-2 px-0.5 py-2 text-[0.7rem] font-semibold ${
        isActive
          ? 'border-sage-600 text-ink-900'
          : 'border-transparent text-ink-600 hover:text-ink-900'
      }`}
    >
      {label}
    </button>
  )
}

export function FeedbackBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[10px] border border-sage-200 bg-sage-50 px-2.5 py-2">
      <h3 className="m-0 mb-1 text-[0.62rem] font-semibold tracking-[0.1em] text-ink-600 uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-sage-200 bg-atelier-elev px-2 py-1.5">
      <span className="block text-[0.6rem] tracking-wide text-ink-400 uppercase">{label}</span>
      <b className="font-mono text-sm font-semibold text-ink-900">{value}</b>
    </div>
  )
}

export function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-sage-200 bg-sage-50 px-2.5 py-1.5">
      <span className="text-ink-600">{label}</span>
      <em className="not-italic font-mono text-[0.75rem] text-ink-900">{value}</em>
    </li>
  )
}
