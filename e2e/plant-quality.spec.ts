import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { plantQualitySummary } from '../src/engine/plant-quality'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare completion with scoring quality on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 68, level: 69, score: 0, rounds: 68, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(69, 69 * 919), { regenerate: false })
  const selected = p.balls[mobile ? 0 : 1].options[2]
  const result = analyzeRound(p, { ballId: selected.plan.ballId, optionId: selected.id }, { samples: 64, talents: DEFAULT_CHARACTER.talents })
  await page.goto('/'); await startLevel(page, 69)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant scoring-quality comparison', exact: true })
  await expect(panel.getByRole('table')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: 'Complete more often', exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('The rankings reverse', { timeout: 30000 })
  await expect(panel.getByRole('status')).toContainText(mobile ? 'Completion-rate choice: Free-ball C.' : 'Choose an objective')
  for (const ball of p.balls) {
    const shot = result.candidates.find(c => c.plan.id === ball.options[2].id)!, summary = plantQualitySummary(shot)!
    await expect(panel.getByRole('table')).toContainText(`${summary.successes}/64`)
    await expect(panel.getByRole('table')).toContainText((shot.score * 100).toFixed(2))
    for (const component of summary.components) await expect(panel.getByRole('table')).toContainText(`${(component * 100).toFixed(2)} pts`)
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('button', { name: 'Maximize weighted score', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Weighted-score choice: Plant C.')
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-quality-${mobile ? 'mobile' : 'desktop'}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 70', exact: true })).toBeVisible()
})
