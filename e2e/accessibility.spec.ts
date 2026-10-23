import { expect, test } from '@playwright/test'
import { startLevel } from './helpers'
import { DEFAULT_CHARACTER } from '../src/engine/characters'

test.beforeEach(async ({ page }) => {
  // These keyboard and screen-reader behaviors do not need a graphics context.
  await page.addInitScript(character => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
  }, DEFAULT_CHARACTER)
})

test('help leads to a focused briefing and both dialogs restore keyboard focus when reopened', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const dialog = page.getByRole('dialog')
  const title = dialog.getByRole('heading', { name: 'Play the percentages.', exact: true })
  await expect(title).toBeFocused()
  await expect(title).toBeInViewport()
  await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBe(0)

  await page.keyboard.press('Escape')
  const briefingTitle = dialog.getByRole('heading', { name: 'Your first pot', exact: true })
  await expect(briefingTitle).toBeFocused()
  await expect(briefingTitle).toBeInViewport()
  await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBe(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Choose your ball.', exact: true })).toBeFocused()

  const opener = page.getByRole('button', { name: 'How to play', exact: true })
  await opener.focus()
  await page.keyboard.press('Enter')
  await expect(title).toBeFocused()
  await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBe(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()

  const review = page.getByRole('button', { name: 'Review level briefing', exact: true })
  await review.focus()
  await page.keyboard.press('Enter')
  await expect(briefingTitle).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(review).toBeFocused()
})

test('closing the automatic briefing starts the level and focuses the first decision', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shot-selection-help-dismissed', 'true'))
  await page.goto('/')
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Choose your ball.', exact: true })).toBeFocused()
})

test('keyboard users can skip navigation and hear each finish’s stroke details', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shot-selection-help-dismissed', 'true'))
  await page.goto('/')
  await startLevel(page, 1)
  await expect(page.getByRole('heading', { name: 'Choose your ball.', exact: true })).toBeVisible()

  const skipLink = page.getByRole('link', { name: 'Skip to game', exact: true })
  await skipLink.focus()
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()

  const ball = page.getByRole('button', { name: 'Select ball 1', exact: true })
  await expect(ball).toBeEnabled({ timeout: 30_000 })
  await expect(ball).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.finish-option')).toHaveCount(0)
  const nextStep = page.getByRole('button', { name: 'Choose a stroke', exact: true })
  await nextStep.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Choose your finish.', exact: true })).toBeFocused()
  for (const label of ['A', 'B', 'C']) {
    await expect(page.getByRole('button', { name: `Choose finish ${label}`, exact: true }))
      .toHaveAccessibleDescription(/\d+\.\d+ m\/s\s+cue-ball speed\s*(?:Backspin|Topspin|No draw \/ follow).*English \(.*side spin\)/)
  }
})
