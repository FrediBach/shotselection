import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'

for (const level of [4, 7]) test(`level ${level} keeps predictions through reveal and permits retry and advancement`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(({ level, character }) => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: level - 1, level, score: 0, rounds: level - 1, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  }, { level, character: DEFAULT_CHARACTER })
  await page.goto('/')
  await startLevel(page, level)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (finish|stroke)$/ }).click()
  const comparison = page.getByRole('region', { name: 'Lesson comparison', exact: true })
  await expect(comparison).toBeVisible()
  await expect(comparison.getByRole('img')).toHaveCount(0)
  const prediction = comparison.getByRole('group', { name: 'Your prediction' }).getByRole('button').first()
  await prediction.click()
  await expect(prediction).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await page.getByRole('button', { name: /Lock in/ }).click()
  await expect(comparison.getByRole('img')).toHaveCount(3, { timeout: 30000 })
  await expect(prediction).toHaveAttribute('aria-pressed', 'true')
  await expect(prediction).toBeDisabled()
  await comparison.getByRole('img').last().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/lesson-comparison-${level}.png` })
  const panel = await page.locator('.shot-panel').boundingBox()
  const nextButton = await page.getByRole('button', { name: 'Next level', exact: true }).boundingBox()
  expect(nextButton!.y + nextButton!.height).toBeLessThanOrEqual(panel!.y + panel!.height)
  await comparison.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(comparison.getByRole('img')).toHaveCount(0)
  await prediction.click()
  await expect(comparison.getByRole('img')).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: `Start level ${level + 1}`, exact: true })).toBeVisible()
})
