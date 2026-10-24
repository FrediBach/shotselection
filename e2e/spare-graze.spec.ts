import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { spareGrazePairFinder } from '../src/engine/spare-graze'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`spare-ball graze on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 42, level: 43, score: 0, rounds: 42, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(43, 43 * 919), { regenerate: false }), c = p.spareGraze!
  const grazed = p.balls[0].options.find(o => o.id === c.grazedId)!, clear = p.balls[0].options.find(o => o.id === c.clearId)!
  const pair = spareGrazePairFinder(p.scenario)(p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) })))!
  const selected = mobile ? grazed : p.balls[0].options.find(o => ![c.grazedId, c.clearId].includes(o.id))!
  await page.goto('/'); await startLevel(page, 43)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Spare-ball graze comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Graze prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${clear.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The other stroke grazes ball 3' : 'Compare the contact and the clear pass', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'grazes ball 3 after potting ball 1' : 'is the third alternative')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(panel.getByRole('img')).toHaveCount(3)
  await expect(panel).toContainText(`Heading change at ball 3${pair.graze.deflection.toFixed(1)}°`)
  await expect(panel).toContainText('Yes, after ball 1 drops')
  await expect(panel).toContainText(`Minimum surface clearance from ball 3${(pair.clean.clearance * 1000).toFixed(1)} mm`)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img', { name: 'Enlarged cue heading before and after the graze', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/spare-graze-heading-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Compare without ball 3', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(4)
  await expect(panel).toContainText(`${(pair.graze.finishShift * 100).toFixed(1)} cm from its actual grazed finish`)
  const removed = panel.getByRole('img', { name: 'Same stroke with only ball 3 removed', exact: true })
  expect(await removed.locator('text').allTextContents()).not.toContain('3')
  await removed.scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/spare-graze-removed-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${grazed.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction identifies the graze')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 44', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
