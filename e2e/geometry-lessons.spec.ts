import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'

for (const level of [12, 13, 14]) test(`level ${level} compares both offered pots before selection and explains the actual geometry`, async ({ page }) => {
  await page.setViewportSize(level === 13 ? { width: 1440, height: 1050 } : { width: 390, height: 844 })
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
  const comparison = page.getByRole('region', { name: 'Lesson comparison', exact: true })
  await expect(comparison.getByRole('img')).toHaveCount(1)
  const prediction = comparison.getByRole('group', { name: 'Your prediction' })
  if (level !== 14) {
    await prediction.getByRole('button', { name: 'Ball 1', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveAttribute('aria-pressed', 'false')
  }
  const opener = level === 13 ? 2 : 1
  await page.getByRole('button', { name: `Select ball ${opener}`, exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(comparison.getByRole('img')).toHaveCount(2, { timeout: 30000 })
  await expect(comparison).toContainText(`Ball ${opener} · your opener`)
  if (level !== 14) {
    await expect(prediction.getByRole('button', { name: 'Ball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(comparison).toContainText('Compare the geometry once more.')
    await comparison.getByRole('button', { name: 'Try the prediction again' }).click()
    await expect(comparison.getByRole('img')).toHaveCount(1)
    await prediction.getByRole('button', { name: 'Ball 2', exact: true }).click()
    await expect(comparison).toContainText('Your prediction matches the geometry.')
  } else {
    await expect(comparison).toContainText('Inspect the two offered routes.')
    await expect(comparison).toContainText('not a measured potting tolerance')
  }
  await comparison.getByRole('img').last().scrollIntoViewIfNeeded()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await page.locator('.shot-panel').screenshot({ path: `/tmp/geometry-lesson-${level}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const panel = await page.locator('.shot-panel').boundingBox()
  const next = page.getByRole('button', { name: 'Next level', exact: true })
  const nextBox = await next.boundingBox()
  expect(nextBox!.y + nextBox!.height).toBeLessThanOrEqual(panel!.y + panel!.height)
  await next.click()
  await expect(page.getByRole('button', { name: `Start level ${level + 1}`, exact: true })).toBeVisible()
})
