import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { returnLanePairFinder } from '../src/engine/return-lane'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`compare return lanes on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 46, level: 47, score: 0, rounds: 46, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(47, 47 * 919), { regenerate: false }), c = p.returnLane!
  const narrow = p.balls[0].options.find(o => o.id === c.riskyId)!, wide = p.balls[0].options.find(o => o.id === c.clearId)!
  const pair = returnLanePairFinder(p.scenario)(p.balls[0].options.map(o => ({plan:o.plan, simulation:simulateShot(p.scenario,o.plan)})))!
  const selected = mobile ? narrow : p.balls[0].options.find(o => ![c.riskyId, c.clearId].includes(o.id))!
  await page.goto('/'); await startLevel(page, 47)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Return-lane clearance comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Return-lane prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${narrow.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The other return leg has more clearance' : 'Compare clearance after the rebound', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'is the narrow-return reference' : 'is the third alternative')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(panel.getByRole('img')).toHaveCount(3)
  await expect(panel).toContainText(`only ${(pair.narrow.clearance * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText(`${(pair.wide.clearance * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText('not an actual nominal graze or a measured collision probability')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img', {name: `Stroke ${narrow.label}: highlighted narrow return leg`, exact:true}).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/return-lane-path-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('img', {name: 'Enlarged narrow return clearance at full ball width', exact:true}).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/return-lane-gap-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Test the narrow return gap', exact: true }).click()
  const probe = panel.getByRole('img', { name: 'Same stroke contacts shifted ball 3 after the rebound', exact: true })
  await expect(probe).toBeVisible()
  for (const id of ['1','2','3','4','5']) expect(await probe.locator('text').allTextContents()).toContain(id)
  await expect(panel).toContainText(`move only ball 3 ${(pair.shifted.shift * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText('now contacts ball 3 after the cushion rebound')
  await probe.scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/return-lane-probe-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${wide.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction leaves more room on the return leg')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 48', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
