import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`fallback plan on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 39, level: 40, score: 0, rounds: 39, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(40, 40 * 919), { regenerate: false }), c = p.fallbackPlan!
  const narrow = p.balls[0].options.find(o => o.id === c.narrowId)!, flexible = p.balls[0].options.find(o => o.id === c.flexibleId)!
  const selected = mobile ? narrow : p.balls[0].options.find(o => ![c.narrowId, c.flexibleId].includes(o.id))!
  await page.goto('/'); await startLevel(page, 40)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Fallback-plan comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Fallback prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(2)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${narrow.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'That finish leaves only one narrow continuation' : 'Compare the available next balls', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'leaves the single narrow route' : 'is the third alternative')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(panel.locator('.fallback-branch')).toHaveCount(2)
  await expect(panel).toContainText('1 playable next ball')
  await expect(panel).toContainText('2 playable next balls')
  const proofs = panel.getByRole('button', { name: /^Inspect stroke/ })
  await expect(proofs).toHaveCount(3)
  for (const button of await proofs.all()) {
    await button.click()
    await expect(panel.getByRole('img')).toHaveCount(3)
    await expect(panel).toContainText('Verified nominal pot')
    await expect(button).toHaveAttribute('aria-expanded', 'true')
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img', { name: /simulated next pot/ }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/fallback-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(2)
  await expect(proofs).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${flexible.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction preserves a fallback')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 41', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
