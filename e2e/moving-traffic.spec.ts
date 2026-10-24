import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`moving traffic on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 41, level: 42, score: 0, rounds: 41, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(42, 42 * 919), { regenerate: false }), c = p.movingTraffic!
  const blocked = p.balls[0].options.find(o => o.id === c.blockedId)!, clear = p.balls[0].options.find(o => o.id === c.clearId)!
  const selected = mobile ? blocked : p.balls[0].options.find(o => ![c.blockedId, c.clearId].includes(o.id))!
  await page.goto('/'); await startLevel(page, 42)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Moving-traffic comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Moving-blocker prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(2)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${clear.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The other stroke moves ball 3' : 'Compare where ball 3 finishes', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'moves ball 3 and loses access' : 'is the third alternative')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const branches = panel.locator('.moving-traffic-branch')
  await expect(branches).toHaveCount(2)
  for (const branch of await branches.all()) {
    await expect(branch).toContainText('Legal opening potYes')
    await expect(branch).toContainText('Inside the shared zoneYes')
  }
  const moved = branches.filter({ hasText: 'Actual permitted next routes0' })
  await expect(moved).toHaveCount(1)
  await expect(moved).toContainText('Cue hit ball 3 after ball 1Yes')
  await expect(moved).toContainText('object-to-pocket line')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await moved.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/moving-traffic-actual-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Reset only ball 3', exact: true }).click()
  await expect(panel.getByRole('img', { name: `Stroke ${blocked.label}: only ball 3 reset`, exact: true })).toBeVisible()
  await expect(moved).toContainText('Reset permitted routes: 1')
  await moved.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/moving-traffic-reset-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Show actual moved traffic', exact: true }).click()
  await panel.getByRole('button', { name: 'Inspect clear continuation', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(3)
  await expect(panel.getByRole('img', { name: 'Unmoved traffic: simulated next pot', exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(2)
  await predictions.getByRole('button', { name: `Stroke ${blocked.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction identifies the moving blocker')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 43', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
