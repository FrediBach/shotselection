import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { corridorCenterPairFinder } from '../src/engine/corridor-center'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`compare corridor margins on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 47, level: 48, score: 0, rounds: 47, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(48, 48 * 919), { regenerate: false }), c = p.corridorCenter!
  const edge = p.balls[0].options.find(o => o.id === c.edgeId)!, center = p.balls[0].options.find(o => o.id === c.centerId)!
  const pair = corridorCenterPairFinder(p.scenario)(p.balls[0].options.map(o => ({plan:o.plan, simulation:simulateShot(p.scenario,o.plan)})))!
  const selected = mobile ? edge : p.balls[0].options.find(o => ![c.edgeId, c.centerId].includes(o.id))!
  await page.goto('/'); await startLevel(page, 48)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Corridor-center comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Corridor-center prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${edge.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The other finish aims nearer the corridor center' : 'Compare the clearance on both sides', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'is the edge reference' : 'is the third alternative')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(panel.getByRole('img')).toHaveCount(4)
  for (const e of [pair.central, pair.marginal]) {
    await expect(panel).toContainText(`${e.route.cutAngle.toFixed(1)}°`)
    for (const b of e.sides) await expect(panel).toContainText(`${(b.clearance * 1000).toFixed(1)} mm`)
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const o of [center, edge]) {
    const label = o.id === c.centerId ? 'center' : 'edge'
    const diagram = panel.getByRole('img', { name: `Stroke ${o.label}: settled finish and next pocket`, exact: true })
    expect(await diagram.locator('text').allTextContents()).toEqual(['', '2', '3', '4', '5'])
    await panel.getByRole('img', { name: `Stroke ${o.label}: enlarged ${label} clearance`, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/corridor-${label}-${mobile ? 'mobile' : 'desktop'}.png` })
    await panel.getByRole('button', { name: `Show stroke ${o.label} next pot`, exact: true }).click()
    const proof = panel.getByRole('img', { name: `Stroke ${o.label}: actual next pot with both gate balls retained`, exact: true })
    await expect(proof).toBeVisible()
    for (const id of ['2', '3', '4', '5']) expect(await proof.locator('text').allTextContents()).toContain(id)
    await proof.scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/corridor-${label}-proof-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${center.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction leaves more room on both sides')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 49', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
