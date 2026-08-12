/**
 * DEV-only shell states for Playwright and design review (#81).
 * Hash: #shell-preview | #shell-preview-filled | #shell-preview-listening
 */

import { HomeScreen } from './HomeScreen'
import {
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
        : createShellPreviewIdleProps()

  return <HomeScreen {...props} />
}
