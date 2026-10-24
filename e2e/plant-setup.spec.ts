import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { shiftedPlantSetup, setupComparison } from '../src/engine/plant-setup'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare paired plant setups on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 69, level: 70, score: 0, rounds: 69, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(70, 70 * 919), { regenerate: false })
  const selected = p.balls[mobile ? 0 : 1].options[2]
  const result = analyzeRound(p, { ballId: selected.plan.ballId, optionId: selected.id }, { samples: 64, talents: DEFAULT_CHARACTER.talents })
  await page.goto('/'); await startLevel(page, 70)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant setup comparison', exact: true })
  const comparison = setupComparison(result.candidates, result.plantSetup!, 1)!
  expect(comparison.outcome).toBe('flip')
  await expect(panel.getByRole('table')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Layout B', exact: true }).click()
  for (const ball of shiftedPlantSetup(p.scenario).balls) {
    expect(Number(await panel.getByTestId(`setup-ball-${ball.id}`).getAttribute('cx'))).toBeCloseTo(ball.position.x, 10)
    expect(Number(await panel.getByTestId(`setup-ball-${ball.id}`).getAttribute('cy'))).toBeCloseTo(ball.position.y, 10)
  }
  if (mobile) await panel.getByRole('button', { name: 'Same route', exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Route flips in this sample. A: Plant. B: Free ball.', { timeout: 30000 })
  for (const shot of result.candidates) {
    const changed = result.plantSetup!.find(c => c.plan.id === shot.plan.id)!
    const row = panel.getByTestId(`setup-score-${shot.plan.id}`)
    await expect(row).toContainText((shot.score * 100).toFixed(2))
    await expect(row).toContainText((changed.score * 100).toFixed(2))
  }
  for (const button of await panel.getByRole('group', { name: 'Setup prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-setup-scores-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Layout A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await panel.getByRole('img', { name: 'Original and shifted plant-pair alignment' }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-setup-pair-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Route flips', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 71', exact: true })).toBeVisible()
})
