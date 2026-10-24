import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'

import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect disconnected regions on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 74, level: 75, score: 0, rounds: 74, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(75, 75 * 919), { regenerate: false }), e = p.disconnectedPosition!
  const expected = analyzeRound(p, { ballId: 1, optionId: e.optionIds[0] }, { samples: 64 })
  await page.goto('/'); await startLevel(page, 75)
  await expect(page.getByTestId('position-zone')).toHaveCount(2)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Disconnected position comparison', exact: true })
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel.getByTestId('region-trial')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: 'Midpoint leaves a shot', exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${mobile ? 'B' : 'A'}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('The midpoint is blocked.', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [index, id] of e.optionIds.entries()) {
    const option = p.balls[0].options.find(o => o.id === id)!, shot = expected.candidates.find(s => s.plan.id === id)!
    await panel.getByRole('button', { name: `Region ${index + 1} · stroke ${option.label}`, exact: true }).click()
    const trials = shot.disconnectedTrials!, ends = trials.filter(t => t.settled && !t.scratch), gap = ends.filter(t => t.gap)
    const cells = panel.getByRole('table').getByRole('cell')
    for (const [i, value] of [`${ends.length}/${shot.samples}`, ...[0, 1].map(r => String(ends.filter(t => t.region === r).length)), String(gap.length), String(ends.filter(t => t.region < 0 && !t.gap).length), `${gap.filter(t => !t.nextShotAvailable).length}/${gap.length}`, `${trials.filter(t => t.success).length}/${shot.samples}`].entries()) await expect(cells.nth(i)).toHaveText(value)
    const dots = panel.getByTestId('region-trial')
    await expect(dots).toHaveCount(ends.length)
    for (const [i, t] of ends.entries()) {
      expect(Number(await dots.nth(i).getAttribute('cx'))).toBeCloseTo(t.point.x, 10)
      expect(Number(await dots.nth(i).getAttribute('cy'))).toBeCloseTo(t.point.y, 10)
      await expect(dots.nth(i)).toHaveAttribute('data-gap', String(t.gap))
    }
    expect(await panel.getByRole('img', { name: 'Two separate regions and actual trial endpoints' }).locator('polyline').getAttribute('points')).toBe(shot.nominal.cuePath.map(p => `${p.x},${p.y}`).join(' '))
  }
  for (const removed of [false, true]) {
    await panel.getByRole('button', { name: removed ? 'Remove blocker' : 'Blocker present', exact: true }).click()
    const sim = removed ? e.removalSimulation : e.blockedSimulation
    expect(await panel.getByRole('img', { name: 'Actual midpoint next-shot experiment' }).locator('polyline').first().getAttribute('points')).toBe(sim.cuePath.map(p => `${p.x},${p.y}`).join(' '))
  }
  for (const button of await panel.getByRole('group', { name: 'Midpoint prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  await panel.getByRole('img').first().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/disconnected-regions-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/disconnected-trials-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByTestId('region-trial')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Midpoint is blocked', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  await expect(panel.getByRole('button', { name: 'Blocker present', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 76', exact: true })).toBeVisible()
})
