/**
 * Study desk as a rail sibling (not a full-screen overlay).
 */

import { StudyScreen } from './StudyScreen'

export function StudyShellPane() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <StudyScreen embedded />
    </div>
  )
}
