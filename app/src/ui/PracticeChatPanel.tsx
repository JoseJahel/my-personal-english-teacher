/**
 * Presentational chat transcript for guided practice turns.
 */

import type { PracticeChatMessage } from './practice-chat-messages'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface PracticeChatPanelProps {
  messages: readonly PracticeChatMessage[]
  firstTurnHintEn: string
}

export function PracticeChatPanel({ messages, firstTurnHintEn }: PracticeChatPanelProps) {
  const copy = homeScreenInterfaceTexts.practiceChat

  return (
    <section className="text-left" aria-label={copy.sectionAriaLabel}>
      <h2 className="text-sm font-semibold text-slate-800">{copy.sectionTitle}</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {copy.turnHintLabel}: <span className="font-medium text-slate-700">{firstTurnHintEn}</span>
      </p>

      <ol className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          return (
            <li
              key={message.id}
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                isUser
                  ? 'ml-auto bg-indigo-600 text-white'
                  : 'mr-auto bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
              }`}
            >
              <span
                className={`mb-1 block text-[10px] font-semibold tracking-wide uppercase ${
                  isUser ? 'text-indigo-100' : 'text-slate-500'
                }`}
              >
                {isUser ? copy.userRoleLabel : copy.tutorRoleLabel}
                {message.kind === 'tutor-fallback' ? ` · ${copy.fallbackBadge}` : ''}
              </span>
              <p className="whitespace-pre-wrap">{message.text}</p>
              {message.correctedText ? (
                <p
                  className={`mt-2 border-t pt-2 text-xs ${
                    isUser ? 'border-indigo-400 text-indigo-100' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <strong>{copy.grammarCorrectionInlineLabel}:</strong> {message.correctedText}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
