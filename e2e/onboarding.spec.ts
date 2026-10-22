import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Onboarding behavior does not depend on a graphics context.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  })
})

test('first visit shows help, remembers dismissal and supports manual reopening', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('Play the percentages.')
  await expect(page.locator('.intro')).toHaveCount(0)
  await expect(page.getByText('Good players make shots.', { exact: false })).toHaveCount(0)
  await page.screenshot({ path: '/tmp/shot-selection-first-visit-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Let’s read the table' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('shot-selection-help-dismissed'))).toBe('true')
  await expect(page.getByRole('button', { name: 'How to play', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Make your call.' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.simulation-overlay')).toHaveCount(0, { timeout: 30_000 })
  await page.screenshot({ path: '/tmp/shot-selection-compact-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Play the percentages.')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const dismissal of ['Escape', 'close button', 'outside click'] as const) {
  test(`help also remembers ${dismissal} dismissal for a visitor with saved progress`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('shot-selection-session', JSON.stringify({ level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
    })
    await page.goto('/')
    await expect(page.getByRole('dialog')).toContainText('Play the percentages.')
    if (dismissal === 'Escape') await page.keyboard.press('Escape')
    else if (dismissal === 'close button') await page.getByRole('button', { name: 'Close dialog' }).click()
    else await page.mouse.click(5, 5)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('shot-selection-help-dismissed'))).toBe('true')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Make your call.' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

test('blocked browser storage leaves help and shot selection usable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const blocked = () => { throw new DOMException('Browser storage is blocked', 'SecurityError') }
    Storage.prototype.getItem = blocked
    Storage.prototype.setItem = blocked
  })
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('Play the percentages.')
  await page.getByRole('button', { name: 'Let’s read the table' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.locator('.ball-choice:enabled').first()).toBeVisible({ timeout: 30_000 })
  await page.locator('.ball-choice:enabled').first().click()
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeEnabled()
  expect(errors).toEqual([])
})
