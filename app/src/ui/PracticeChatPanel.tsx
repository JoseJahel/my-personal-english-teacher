/**
 * Presentational chat thread for guided practice (Atelier shell center column).
 */

import type { PracticeChatMessage } from './practice-chat-messages'
import { homeScreenInterfaceTexts } from './interface-texts'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'

export interface PracticeChatPanelProps {
  messages: readonly PracticeChatMessage[]
  firstTurnHintEn: string
  /** SmolLM2 is still downloading/loading — shown as a discreet strip above the transcript. */
  isTutorPreparingConversationModel: boolean
  /** `generateTutorReply` is in flight — shown as a "typing…" bubble at the end of the list. */
  isTutorComposingReply: boolean
  tutorGenerationStatusMessage: string
  /** Hide the section title when the shell center-bar already shows the scenario. */
  showSectionChrome?: boolean
}

export function PracticeChatPanel({
  messages,
  firstTurnHintEn,
  isTutorPreparingConversationModel,
  isTutorComposingReply,
  tutorGenerationStatusMessage,
  showSectionChrome = false,
}: PracticeChatPanelProps) {
  const copy = homeScreenInterfaceTexts.practiceChat

  return (
    <section
      className="flex w-full max-w-[44rem] flex-1 flex-col text-left"
      aria-label={copy.sectionAriaLabel}
      data-testid={PRACTICE_SHELL_TEST_IDS.chatThread}
    >
      {showSectionChrome ? (
        <>
          <h2 className="text-sm font-semibold text-ink-900">{copy.sectionTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            {copy.turnHintLabel}: <span className="font-medium text-ink-600">{firstTurnHintEn}</span>
          </p>
        </>
      ) : null}

      {/*
        Always-mounted live region (screen readers reliably announce a TEXT
        change inside a persistent aria-live node; they often miss a node
        that appears in the DOM already carrying its final text).
      */}
      <p
        aria-live="polite"
        className={
          isTutorPreparingConversationModel
            ? 'mb-3 rounded-lg bg-sage-100 px-3 py-2 text-xs text-sage-800 ring-1 ring-sage-200'
            : 'm-0 max-h-0 overflow-hidden border-0 p-0'
        }
      >
        {isTutorPreparingConversationModel ? tutorGenerationStatusMessage : null}
      </p>

      <ol className="relative m-0 flex flex-1 list-none flex-col gap-3.5 p-0">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          return (
            <li
              key={message.id}
              className={`max-w-[92%] ${isUser ? 'ml-auto self-end' : 'mr-auto self-start'}`}
            >
              <span
                className={`mb-1 block text-[0.65rem] font-semibold tracking-[0.06em] text-ink-600 uppercase`}
              >
                {isUser ? copy.userRoleLabel : copy.tutorRoleLabel}
                {message.kind === 'tutor-fallback' ? (
                  <span className="ml-1.5 inline-block rounded bg-sage-100 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-normal text-sage-700 normal-case">
                    {copy.fallbackBadge}
                  </span>
                ) : null}
              </span>
              <div
                className={`rounded-xl px-4 py-3 text-[0.95rem] leading-relaxed shadow-sm ${
                  isUser
                    ? 'rounded-br-sm bg-ink-900 text-sage-50'
                    : 'rounded-bl-sm border border-sage-200 bg-atelier-elev text-ink-900'
                }`}
              >
                <p className="m-0 whitespace-pre-wrap">{message.text}</p>
                {message.correctedText ? (
                  <p
                    className={`mt-2 border-t pt-2 text-xs ${
                      isUser ? 'border-sage-700 text-sage-300' : 'border-sage-200 text-ink-600'
                    }`}
                  >
                    <strong>{copy.grammarCorrectionInlineLabel}:</strong> {message.correctedText}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
        <li
          aria-live="polite"
          className={
            isTutorComposingReply
              ? 'mr-auto max-w-[92%] self-start'
              : 'absolute m-0 max-h-0 overflow-hidden border-0 p-0'
          }
        >
          {isTutorComposingReply ? (
            <>
              <span className="mb-1 block text-[0.65rem] font-semibold tracking-[0.06em] text-ink-600 uppercase">
                {copy.tutorRoleLabel}
              </span>
              <div className="rounded-xl rounded-bl-sm border border-sage-200 bg-atelier-elev px-4 py-3 text-sm text-ink-400 shadow-sm">
                <p className="m-0">{copy.tutorTypingLabel}</p>
              </div>
            </>
          ) : null}
        </li>
      </ol>
    </section>
  )
}
