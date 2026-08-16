/**
 * Navigation and panel state for the Atelier practice shell (issue #81).
 */

export type PracticeShellView = 'practice' | 'history' | 'signals'

export type PracticeFeedbackTab = 'turn' | 'suggest' | 'signals' | 'tech'

/** Practice mode switch in the rail; drill UI is present but not wired yet (#68). */
export type PracticeModeId = 'conversation' | 'drill'

export const PRACTICE_SHELL_TEST_IDS = {
  shell: 'practice-shell',
  rail: 'practice-rail',
  center: 'practice-center',
  panel: 'feedback-panel',
  panelToggle: 'feedback-panel-toggle',
  panelClose: 'feedback-panel-close',
  micButton: 'mic-button',
  stopButton: 'stop-button',
  composer: 'practice-composer',
  chatThread: 'chat-thread',
  historyOverlay: 'history-overlay',
  signalsOverlay: 'signals-overlay',
  railNavPractice: 'rail-nav-practice',
  railNavHistory: 'rail-nav-history',
  railNavSignals: 'rail-nav-signals',
  asrDemoProfileBadge: 'asr-demo-profile-badge',
  practiceMockBanner: 'practice-mock-banner',
  practiceMockExit: 'practice-mock-exit',
  practiceMockGate: 'practice-mock-gate',
  practiceMockGateReal: 'practice-mock-gate-real',
  practiceMockGateEnter: 'practice-mock-gate-enter',
  tabTurn: 'panel-tab-turn',
  tabSuggest: 'panel-tab-suggest',
  tabSignals: 'panel-tab-signals',
  tabTech: 'panel-tab-tech',
  panelEmpty: 'panel-empty-state',
  panelFilled: 'panel-filled-state',
} as const
