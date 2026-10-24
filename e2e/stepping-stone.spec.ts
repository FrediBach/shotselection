import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`stepping stone on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 37, level: 38, score: 0, rounds: 37, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(38, 38 * 919), { regenerate: false })
  const selected = p.balls[0].options.find(o => mobile ? o.id === p.steppingStoneOptionId : o.id !== p.steppingStoneOptionId)!
  await page.goto('/'); await startLevel(page, 38)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Stepping-stone comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Order prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(1)
  if (mobile) await predictions.getByRole('button', { name: '2 → 3: distant first', exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(5, { timeout: 30000 })
  await expect(panel.getByRole('status')).toContainText(mobile ? 'Distant first works here too' : 'Compare both completed orders')
  await expect(panel).toContainText(mobile ? 'these sequences use its actual nominal finish' : 'these sequences do not describe your selected finish')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  for (const branch of await panel.locator('.stepping-stone-branch').all()) {
    await expect(branch).toContainText('Legal pots, no scratch2 of 2')
    await expect(branch.getByRole('img')).toHaveCount(2)
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const order of ['Distant-first', 'Nearer-first']) {
    await panel.getByRole('img', { name: `${order} order: simulated pot on ball 2`, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/stepping-${order}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the order prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(1)
  await predictions.getByRole('button', { name: '3 → 2: nearer first', exact: true }).click()
  await panel.getByRole('button', { name: 'Check order prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction uses ball 3 as the stepping stone')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 39', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
