import type { AsrDemoProfileId } from '../ia/model-registry'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface AsrDemoProfileRailPresentation {
  readonly label: string
  readonly title: string
  readonly tone: AsrDemoProfileId
}

export function resolveAsrDemoProfileRailPresentation(
  profile: AsrDemoProfileId,
): AsrDemoProfileRailPresentation {
  const copy = homeScreenInterfaceTexts.asrDemoProfile
  if (profile === 'latency') {
    return {
      label: copy.latencyRailLabel,
      title: copy.latencyTitle,
      tone: 'latency',
    }
  }
  return {
    label: copy.precisionRailLabel,
    title: copy.precisionTitle,
    tone: 'precision',
  }
}
