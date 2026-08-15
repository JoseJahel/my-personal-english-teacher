/**
 * DEV-only shell states for Playwright and design review (#81).
 * Hash: #shell-preview | #shell-preview-filled | #shell-preview-listening
 * | #shell-preview-composing
 */

import { HomeScreen } from './HomeScreen'
import {
  createShellPreviewComposingProps,
  createShellPreviewFilledProps,
  createShellPreviewIdleProps,
  createShellPreviewListeningProps,
  type ShellPreviewVariant,
} from './shell-preview-fixture'

export function ShellPreviewScreen({ variant }: { variant: ShellPreviewVariant }) {
  const props =
    variant === 'filled'
      ? createShellPreviewFilledProps()
      : variant === 'listening'
        ? createShellPreviewListeningProps()
        : variant === 'composing'
          ? createShellPreviewComposingProps()
          : createShellPreviewIdleProps()

  return <HomeScreen {...props} />
}
