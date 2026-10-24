import { expect, test } from '@playwright/test'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`exit from the zone on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 34, level: 35, score: 0, rounds: 34, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(35, 35 * 919), { regenerate: false }), contrast = p.zoneExit!
  const label = (id: string) => p.balls[0].options.find(o => o.id === id)!.label
  await page.goto('/'); await startLevel(page, 35)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const comparison = page.getByRole('region', { name: 'Exit from the landing zone', exact: true })
  const predictions = comparison.getByRole('group', { name: 'Blocked-exit prediction' })
  await expect(predictions.getByRole('button')).toHaveCount(2)
  await expect(comparison.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${label(contrast.clearId)}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${label(mobile ? contrast.blockedId : contrast.clearId)}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(comparison.getByRole('img')).toHaveCount(2, { timeout: 30000 })
  await expect(comparison).toContainText(mobile ? 'ball 3 blocks the exit' : 'leaves a clear exit')
  await expect(comparison.getByRole('status')).toContainText(mobile ? 'Reaching the circle is only the first check' : 'Trace both exits')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  for (const branch of await comparison.locator('.zone-exit-branch').all()) {
    await expect(branch).toContainText('Legal opening potYes')
    await expect(branch).toContainText('Inside the shared zoneYes')
    await expect(branch).toContainText('Object-to-pocket line clear of ball 3Yes')
  }
  const blocked = comparison.locator('.zone-exit-branch').filter({ hasText: 'Blocked exit' })
  await expect(blocked).toContainText('Cue approach blocked by ball 3Yes')
  await expect(blocked).toContainText('Permitted next routes0')
  await comparison.getByRole('button', { name: 'Check without ball 3', exact: true }).click()
  await expect(comparison.getByRole('img')).toHaveCount(3)
  await expect(comparison).toContainText('Counterfactual: remove only ball 3')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await blocked.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/zone-exit-${mobile ? 'mobile' : 'desktop'}.png` })
  await comparison.getByRole('img', { name: 'Counterfactual clear approach with only ball 3 removed', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/zone-exit-restored-${mobile ? 'mobile' : 'desktop'}.png` })
  await comparison.getByRole('button', { name: 'Inspect the clear continuation', exact: true }).click()
  await expect(comparison.getByRole('img')).toHaveCount(4)
  await comparison.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(comparison.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${label(contrast.blockedId)}`, exact: true }).click()
  await comparison.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(comparison.getByRole('status')).toContainText('Your prediction identifies')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 36', exact: true })).toBeVisible()
  await expect(comparison).toHaveCount(0)
})
