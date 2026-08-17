import { expect, test } from '@playwright/test'

/**
 * Issue #70 — live rehearsal of HomeScreen with injected mocks.
 * Unlike #shell-preview*, this path clicks Hablar/Detener on the real shell.
 */

test.describe('practice mock rehearsal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('mpet-skip-practice-mock')
      const rejectMicrophone = async () => {
        throw new Error('getUserMedia must not run in practice mock')
      }
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: rejectMicrophone,
          enumerateDevices: async () => [],
        },
      })
    })
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('hash shows the confirmation gate first', async ({ page }) => {
    await page.goto('/#practice-mock')
    await expect(page.getByTestId('practice-mock-gate')).toBeVisible()
    await expect(page.getByTestId('practice-shell')).toHaveCount(0)
  })

  test('alias hash #ensayo-ui uses the same gate', async ({ page }) => {
    await page.goto('/#ensayo-ui')
    await expect(page.getByTestId('practice-mock-gate')).toBeVisible()
  })

  test('choosing real practice leaves the mock', async ({ page }) => {
    await page.goto('/#practice-mock')
    await page.getByTestId('practice-mock-gate-real').click()
    await expect(page.getByTestId('practice-mock-gate')).toHaveCount(0)
    await expect(page.getByTestId('practice-mock-banner')).toHaveCount(0)
    await expect(page.getByTestId('practice-shell')).toBeVisible()
  })

  test('confirmed rehearsal completes a restaurant turn without the mic', async ({
    page,
  }) => {
    await page.goto('/#practice-mock')
    await page.getByTestId('practice-mock-gate-enter').click()
    await expect(page.getByTestId('practice-mock-banner')).toBeVisible()

    await page.getByTestId('mic-button').click()
    await expect(page.getByTestId('mic-button')).toHaveAttribute('data-state', 'listening')
    await expect(page.getByTestId('feedback-panel')).toHaveAttribute('data-open', 'true')
    await expect(page.getByTestId('panel-tab-signals')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('spectrogram-canvas')).toBeVisible()
    await expect(page.getByTestId('pitch-track-canvas')).toBeVisible()
    await page.getByTestId('stop-button').click()

    await expect(page.getByTestId('chat-thread')).toContainText(
      'I would like a glass of water please',
    )
    await expect(page.getByTestId('chat-thread')).toContainText(
      'Certainly — water. Would you like a main dish with that?',
    )
    await expect(page.getByTestId('feedback-panel')).toHaveAttribute('data-open', 'true')

    const signalCard = page.getByTestId('turn-signal-card')
    await expect(signalCard).toBeVisible()
    await expect(signalCard).toHaveAttribute('data-card-kind', 'deferred-to-drill')
    await signalCard.locator('summary').click()
    await expect(signalCard).toContainText('Repetir')
    await page.getByTestId('turn-signal-card-open-signals').click()
    await expect(page.getByTestId('panel-tab-signals')).toHaveAttribute('aria-selected', 'true')
  })

  test('force query skips the gate', async ({ page }) => {
    await page.goto('/?forzar-ensayo=1#practice-mock')
    await expect(page.getByTestId('practice-mock-banner')).toBeVisible()
    await expect(page.getByTestId('practice-mock-gate')).toHaveCount(0)
  })
})
