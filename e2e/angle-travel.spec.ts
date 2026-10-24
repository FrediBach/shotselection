import { expect, test } from '@playwright/test'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { lookAheadPairFinder } from '../src/engine/look-ahead'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`angle and travel to ball 3 on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 35, level: 36, score: 0, rounds: 35, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(36, 36 * 919), { regenerate: false })
  const pair = lookAheadPairFinder(p.scenario)(p.balls[0].options.filter(o => p.lookAheadOptionIds?.includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) })))!
  const selected = mobile ? pair.lost : pair.kept
  const label = (id: string) => p.balls[0].options.find(o => o.id === id)!.label
  await page.goto('/'); await startLevel(page, 36)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const comparison = page.getByRole('region', { name: 'Angle and travel to ball 3', exact: true })
  const predictions = comparison.getByRole('group', { name: 'Look-ahead prediction' })
  await expect(predictions.getByRole('button')).toHaveCount(2)
  await expect(comparison.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${label(selected.opening.plan.id)}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${label(selected.opening.plan.id)}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(comparison.getByRole('img')).toHaveCount(4, { timeout: 30000 })
  await expect(comparison).toContainText(mobile ? 'fuller contact, which finishes short' : 'thinner contact and enough travel')
  await expect(comparison.getByRole('status')).toContainText(mobile ? 'The fuller contact leaves the cue short' : 'Compare the fuller and thinner second contacts')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  for (const branch of await comparison.locator('.look-ahead-branch').all()) {
    await expect(branch).toContainText('Opening finish in zoneYes')
    await expect(branch).toContainText('Matched second potLegal, no scratch')
    await expect(branch).toContainText('Second-cut magnitude')
    await expect(branch).toContainText('Signed second angle')
    await expect(branch).toContainText('Contact-to-finish distance')
  }
  await expect(comparison).toContainText('Only the aim adjusts')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await comparison.getByRole('heading', { name: 'How much angle is enough?' }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/angle-travel-${mobile ? 'mobile' : 'desktop'}.png` })
  await comparison.getByRole('img', { name: `Stroke ${label(pair.kept.opening.plan.id)}: verified third pot`, exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/angle-travel-continuation-${mobile ? 'mobile' : 'desktop'}.png` })
  await comparison.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(comparison.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${label(pair.kept.opening.plan.id)}`, exact: true }).click()
  await comparison.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(comparison.getByRole('status')).toContainText('Your prediction leaves enough angle and travel')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 37', exact: true })).toBeVisible()
  await expect(comparison).toHaveCount(0)
})
