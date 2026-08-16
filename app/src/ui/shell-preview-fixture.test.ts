import { describe, expect, it } from 'vitest'
import {
  createShellPreviewComposingProps,
  resolveShellPreviewVariant,
} from './shell-preview-fixture'

describe('resolveShellPreviewVariant', () => {
  it('maps the composing hash used to close issue #96 without models', () => {
    expect(resolveShellPreviewVariant('#shell-preview-composing')).toBe('composing')
  })
})

describe('createShellPreviewComposingProps', () => {
  it('shows the student turn and typing tutor without locking the mic', () => {
    const props = createShellPreviewComposingProps()
    const lastMessage = props.chatMessages[props.chatMessages.length - 1]

    expect(lastMessage?.role).toBe('user')
    expect(lastMessage?.correctedText).toMatch(/please/i)
    expect(props.isTutorComposingReply).toBe(true)
    expect(props.isTutorSpeaking).toBe(false)
    expect(props.isListening).toBe(false)
    expect(props.isStarting).toBe(false)
  })
})
