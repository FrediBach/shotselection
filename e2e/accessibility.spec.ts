import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // These keyboard and screen-reader behaviors do not need a graphics context.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
    localStorage.setItem('shot-selection-session', JSON.stringify({ level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
  })
})

test('help starts at its heading and returns keyboard focus after dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const dialog = page.getByRole('dialog')
  const title = dialog.getByRole('heading', { name: 'Play the percentages.', exact: true })
  await expect(title).toBeFocused()
  await expect(title).toBeInViewport()
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
})

test('keyboard users can skip navigation and hear each finish’s stroke details', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shot-selection-help-dismissed', 'true'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choose your ball.', exact: true })).toBeVisible()

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Skip to game', exact: true })
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()

  const ball = page.getByRole('button', { name: 'Select ball 1', exact: true })
  await expect(ball).toBeEnabled({ timeout: 30_000 })
  await ball.focus()
  await page.keyboard.press('Enter')
  const nextStep = page.getByRole('button', { name: 'Choose a finish', exact: true })
  await nextStep.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Choose your finish.', exact: true })).toBeFocused()
  for (const label of ['A', 'B', 'C']) {
    await expect(page.getByRole('button', { name: `Choose finish ${label}`, exact: true }))
      .toHaveAccessibleDescription(/\d+\.\d+ m\/s\s+cue-ball speed\s*(?:Backspin|Topspin|Center ball)/)
  }
})
