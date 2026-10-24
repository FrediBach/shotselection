import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { pocketChangePairFinder } from '../src/engine/pocket-change'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`change next pocket on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 43, level: 44, score: 0, rounds: 43, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(44, 44 * 919), { regenerate: false }), c = p.pocketChange!
  const original = p.balls[0].options.find(o => o.id === c.originalId)!, adapted = p.balls[0].options.find(o => o.id === c.adaptedId)!
  const pair = pocketChangePairFinder(p.scenario)(p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) })))!
  const selected = mobile ? original : p.balls[0].options.find(o => ![c.originalId, c.adaptedId].includes(o.id))!
  await page.goto('/'); await startLevel(page, 44)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Change-of-pocket comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Alternative-pocket finish prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${original.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'Changing pockets also needs the other finish' : 'Compare the pocket and finish together', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'leaves the original finish with no permitted next route' : 'is the third alternative')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(panel.getByRole('img')).toHaveCount(3)
  await expect(panel).toContainText(`the ${pair.oldAlternate.cutAngle.toFixed(1)}° cut exceeds`)
  await expect(panel).toContainText(`a ${pair.alternate.cutAngle.toFixed(1)}° cut within the limit`)
  await expect(panel).toContainText('Both strokes pot ball 1 into the same pocket and finish inside the same zone')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [name, suffix] of [['Original finish: preferred pocket blocked by traffic', 'blocked'], ['Original finish: alternative pocket exceeds the cut limit', 'old-cut'], ['Adapted finish: alternative pocket is available', 'adapted']]) {
    await panel.getByRole('img', { name, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/pocket-change-${suffix}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: `Check preferred pocket without ball ${c.blockerId}`, exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(4)
  const removed = panel.getByRole('img', { name: 'Preferred-pocket proof with only the blocker removed', exact: true })
  expect(await removed.locator('text').allTextContents()).not.toContain(String(c.blockerId))
  await expect(panel).toContainText('This diagnostic removal is not a gameplay option')
  await panel.getByRole('button', { name: 'Inspect the alternative-pocket pot', exact: true }).click()
  await expect(removed).toHaveCount(0)
  await expect(panel.getByRole('img')).toHaveCount(4)
  const proof = panel.getByRole('img', { name: 'Alternative-pocket proof with all remaining balls', exact: true })
  expect(await proof.locator('text').allTextContents()).toContain(String(c.blockerId))
  await proof.scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/pocket-change-proof-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${adapted.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction adapts the finish to the new pocket')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 45', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
