/**
 * Presentational chat transcript for guided practice turns.
 */

import type { PracticeChatMessage } from './practice-chat-messages'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface PracticeChatPanelProps {
  messages: readonly PracticeChatMessage[]
  firstTurnHintEn: string
  /** SmolLM2 is still downloading/loading — shown as a discreet strip above the transcript. */
  isTutorPreparingConversationModel: boolean
  /** `generateTutorReply` is in flight — shown as a "typing…" bubble at the end of the list. */
  isTutorComposingReply: boolean
  tutorGenerationStatusMessage: string
}

export function PracticeChatPanel({
  messages,
  firstTurnHintEn,
  isTutorPreparingConversationModel,
  isTutorComposingReply,
  tutorGenerationStatusMessage,
}: PracticeChatPanelProps) {
  const copy = homeScreenInterfaceTexts.practiceChat

  return (
    <section className="text-left" aria-label={copy.sectionAriaLabel}>
      <h2 className="text-sm font-semibold text-ink-900">{copy.sectionTitle}</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-400">
        {copy.turnHintLabel}: <span className="font-medium text-ink-600">{firstTurnHintEn}</span>
      </p>

      {/*
        Always-mounted live region (screen readers reliably announce a TEXT
        change inside a persistent aria-live node; they often miss a node
        that appears in the DOM already carrying its final text). Visual
        collapse uses max-h-0 + overflow-hidden instead of `hidden` /
        display:none, which several screen readers also silence.
      */}
      <p
        aria-live="polite"
        className={
          isTutorPreparingConversationModel
            ? 'mt-3 rounded-lg bg-sage-100 px-3 py-2 text-xs text-sage-800 ring-1 ring-sage-200'
            : 'm-0 max-h-0 overflow-hidden border-0 p-0'
        }
      >
        {isTutorPreparingConversationModel ? tutorGenerationStatusMessage : null}
      </p>

      <ol className="relative mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xl bg-sage-50 p-3 ring-1 ring-sage-200">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          return (
            <li
              key={message.id}
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                isUser
                  ? 'ml-auto bg-sage-800 text-white'
                  : 'mr-auto bg-white text-ink-900 shadow-sm ring-1 ring-sage-200'
              }`}
            >
              <span
                className={`mb-1 block text-[10px] font-semibold tracking-wide uppercase ${
                  isUser ? 'text-sage-300' : 'text-ink-400'
                }`}
              >
                {isUser ? copy.userRoleLabel : copy.tutorRoleLabel}
                {message.kind === 'tutor-fallback' ? ` · ${copy.fallbackBadge}` : ''}
              </span>
              <p className="whitespace-pre-wrap">{message.text}</p>
              {message.correctedText ? (
                <p
                  className={`mt-2 border-t pt-2 text-xs ${
                    isUser ? 'border-sage-400 text-sage-300' : 'border-sage-200 text-ink-600'
                  }`}
                >
                  <strong>{copy.grammarCorrectionInlineLabel}:</strong> {message.correctedText}
                </p>
              ) : null}
            </li>
          )
        })}
        {/* Same always-mounted live-region pattern as the preparing strip above. */}
        <li
          aria-live="polite"
          className={
            isTutorComposingReply
              ? 'mr-auto max-w-[90%] rounded-lg bg-white px-3 py-2 text-sm text-ink-400 shadow-sm ring-1 ring-sage-200'
              : 'absolute m-0 max-h-0 overflow-hidden border-0 p-0'
          }
        >
          {isTutorComposingReply ? (
            <>
              <span className="mb-1 block text-[10px] font-semibold tracking-wide uppercase text-ink-400">
                {copy.tutorRoleLabel}
              </span>
              <p>{copy.tutorTypingLabel}</p>
            </>
          ) : null}
        </li>
      </ol>
    </section>
  )
}
