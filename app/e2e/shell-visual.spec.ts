import { expect, test } from '@playwright/test'

/**
 * Issue #81 — Atelier shell smoke + visual baselines.
 * Fixtures: #shell-preview* (no models, no mic).
 */

test.describe('practice shell — structure', () => {
  test('idle shell: rail + center + closed panel + empty state when opened', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview')

    await expect(page.getByTestId('practice-shell')).toBeVisible()
    await expect(page.getByTestId('practice-rail')).toBeVisible()
    const asrBadge = page.getByTestId('asr-demo-profile-badge')
    await expect(asrBadge).toBeVisible()
    await expect(asrBadge).toHaveAttribute('data-asr-profile', 'precision')
    await expect(asrBadge).toContainText('small-en')
    await expect(page.getByTestId('practice-center')).toBeVisible()
    await expect(page.getByTestId('practice-composer')).toBeVisible()
    await expect(page.getByTestId('chat-thread')).toBeVisible()

    const panel = page.getByTestId('feedback-panel')
    await expect(panel).toHaveAttribute('data-open', 'false')

    await page.getByTestId('feedback-panel-toggle').click()
    await expect(panel).toHaveAttribute('data-open', 'true')
    await expect(page.getByTestId('panel-empty-state')).toBeVisible()

    await page.getByTestId('feedback-panel-close').click()
    await expect(panel).toHaveAttribute('data-open', 'false')
  })

  test('filled turn opens panel with filled feedback regions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview-filled')

    const panel = page.getByTestId('feedback-panel')
    await expect(panel).toHaveAttribute('data-open', 'true')
    await expect(page.getByTestId('panel-filled-state')).toBeVisible()
    await expect(page.getByTestId('panel-tab-turn')).toHaveAttribute('aria-selected', 'true')

    await page.getByTestId('panel-tab-suggest').click()
    const suggestionsTab = page.getByTestId('feedback-panel').getByTestId('communication-suggestions')
    await expect(suggestionsTab).toBeVisible()
    await expect(suggestionsTab).toContainText('Could I have a glass of water, please?')

    await page.getByTestId('panel-tab-signals').click()
    await expect(page.getByTestId('formant-vowel-map')).toBeVisible()

    const signalCard = page.getByTestId('turn-signal-card')
    await expect(signalCard).toBeVisible()
    await signalCard.locator('summary').click()
    await expect(signalCard).toContainText('78')
    await page.getByTestId('turn-signal-card-open-signals').click()
    await expect(page.getByTestId('panel-tab-signals')).toHaveAttribute('aria-selected', 'true')
  })

  test('listening state sets mic data-state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview-listening')

    const mic = page.getByTestId('mic-button')
    await expect(mic).toHaveAttribute('data-state', 'listening')
    await expect(mic).toBeDisabled()
    await expect(page.getByTestId('stop-button')).toBeEnabled()
  })

  test('history overlay opens from rail and returns to practice', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview')

    await page.getByTestId('rail-nav-history').click()
    await expect(page.getByTestId('history-overlay')).toBeVisible()

    await page.getByRole('button', { name: /Volver a práctica/i }).click()
    await expect(page.getByTestId('history-overlay')).toHaveCount(0)
  })

  test('history overlay shows streak and good-turn habit chips', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview-filled')

    await page.getByTestId('rail-nav-history').click()
    await expect(page.getByTestId('history-overlay')).toBeVisible()
    await expect(page.getByTestId('practice-habit-streak')).toBeVisible()
    await expect(page.getByTestId('practice-habit-good-turns')).toContainText('1')
  })

  test('composing state shows user turn before tutor and keeps Hablar enabled', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview-composing')

    await expect(page.getByTestId('chat-thread')).toContainText(
      'I would like a glass of water please',
    )
    await expect(page.getByTestId('chat-thread')).toContainText('Escribiendo…')
    await expect(page.getByTestId('chat-thread')).not.toContainText(
      'Great choice. Would you like something to drink with that?',
    )

    const mic = page.getByTestId('mic-button')
    await expect(mic).toBeEnabled()
    await expect(mic).toHaveAttribute('data-state', 'idle')
  })

  test('signals rail opens feedback panel on signals tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview')

    await page.getByTestId('rail-nav-signals').click()
    await expect(page.getByTestId('feedback-panel')).toHaveAttribute('data-open', 'true')
    await expect(page.getByTestId('panel-tab-signals')).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('practice shell — screenshots', () => {
  test('baseline idle 1280x800', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview')
    await expect(page.getByTestId('practice-shell')).toBeVisible()
    await expect(page).toHaveScreenshot('shell-idle-1280.png', { fullPage: true })
  })

  test('baseline panel open empty 1280x800', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview')
    await page.getByTestId('feedback-panel-toggle').click()
    await expect(page.getByTestId('panel-empty-state')).toBeVisible()
    await expect(page).toHaveScreenshot('shell-panel-empty-1280.png', { fullPage: true })
  })

  test('baseline filled turn 1280x800', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#shell-preview-filled')
    await expect(page.getByTestId('panel-filled-state')).toBeVisible()
    await expect(page).toHaveScreenshot('shell-filled-1280.png', { fullPage: true })
  })

  test('baseline listening 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#shell-preview-listening')
    await expect(page.getByTestId('mic-button')).toHaveAttribute('data-state', 'listening')
    await expect(page).toHaveScreenshot('shell-listening-1440.png', { fullPage: true })
  })
})
