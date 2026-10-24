import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { englishName } from '../src/engine/mirror-english'

import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect mirrored English on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 73, level: 74, score: 0, rounds: 73, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(74, 74 * 919), { regenerate: false }), e = p.mirrorEnglish!
  await page.goto('/'); await startLevel(page, 74)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Mirrored English comparison', exact: true })
  const mirrored = panel.getByRole('img', { name: 'Mirrored English route', exact: true })
  await expect(mirrored.locator('polyline')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: englishName(e.original.plan.sideSpin), exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${mobile ? 'C' : 'A'}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(`${englishName(e.reversed.plan.sideSpin)} reproduces`, { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const copied of [false, true]) {
    await panel.getByRole('button', { name: copied ? 'Copied sign' : 'Reversed sign', exact: true }).click()
    const sim = (copied ? e.copied : e.reversed).simulation
    expect(await mirrored.locator('polyline').first().getAttribute('points')).toBe(sim.cuePath.map(p => `${p.x},${p.y}`).join(' '))
  }
  await expect(panel).toContainText(`${e.outgoingDifference.toFixed(1)}°`)
  await expect(panel).toContainText(`${(e.endpointDifference * 100).toFixed(1)} cm`)
  for (const [index, key] of (['legalPot', 'positioned', 'nextShotAvailable', 'success'] as const).entries()) {
    const cells = panel.getByRole('row').nth(index + 1).getByRole('cell')
    await expect(cells.nth(0)).toHaveText(e.reversed.outcome[key] ? 'Yes' : 'No')
    await expect(cells.nth(1)).toHaveText(e.copied.outcome[key] ? 'Yes' : 'No')
  }
  for (const button of await panel.getByRole('group', { name: 'Mirrored spin prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  await mirrored.scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/mirror-english-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(mirrored.locator('polyline')).toHaveCount(0)
  await panel.getByRole('button', { name: englishName(e.reversed.plan.sideSpin), exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  await expect(panel.getByRole('button', { name: 'Reversed sign', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 75', exact: true })).toBeVisible()
})
