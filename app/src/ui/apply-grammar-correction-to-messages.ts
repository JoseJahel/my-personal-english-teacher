import {
  createUserUtteranceMessage,
  type PracticeChatMessage,
} from './practice-chat-messages'

/**
 * Patch the last matching user bubble with T5 output. Does not append a turn.
 */
export function applyGrammarCorrectionToLastUserMessage(
  messages: readonly PracticeChatMessage[],
  transcribedText: string,
  correctedText: string,
): PracticeChatMessage[] {
  const transcript = transcribedText.trim()
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.kind !== 'user-utterance' || message.text !== transcript) {
      continue
    }
    const next = messages.slice()
    next[index] = createUserUtteranceMessage(transcribedText, correctedText, message.id, {
      signalCard: message.signalCard,
    })
    return next
  }
  return messages.slice()
}
