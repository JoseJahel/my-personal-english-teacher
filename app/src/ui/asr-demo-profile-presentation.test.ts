import { describe, expect, it } from 'vitest'
import { homeScreenInterfaceTexts } from './interface-texts'
import { resolveAsrDemoProfileRailPresentation } from './asr-demo-profile-presentation'

describe('resolveAsrDemoProfileRailPresentation', () => {
  it('labels the precision profile without claiming a sub-2s budget', () => {
    const presentation = resolveAsrDemoProfileRailPresentation('precision')
    expect(presentation.label).toBe(homeScreenInterfaceTexts.asrDemoProfile.precisionRailLabel)
    expect(presentation.tone).toBe('precision')
    expect(presentation.title.toLowerCase()).not.toContain('< 2')
  })

  it('labels the latency profile without inventing a millisecond figure', () => {
    const presentation = resolveAsrDemoProfileRailPresentation('latency')
    expect(presentation.label).toBe(homeScreenInterfaceTexts.asrDemoProfile.latencyRailLabel)
    expect(presentation.tone).toBe('latency')
    expect(presentation.title).not.toMatch(/\d+\s*ms/i)
    expect(presentation.title).toMatch(/no afirma/i)
  })
})
