import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { simulateShot } from '../src/engine/physics'
import { compareHouseCue } from '../src/engine/house-cue'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare requested and delivered spin on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 94, level: 95, score: 0, rounds: 94, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(95, 95 * 919))
  await page.goto('/'); await startLevel(page, 95)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'House cue spin comparison', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('House cue', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const ball of prepared.balls) for (const option of ball.options) {
    const data = compareHouseCue(prepared.scenario, option.plan, simulateShot(prepared.scenario, option.plan))!
    await panel.getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('button', { name: 'House cue', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByTestId('house-controls')).toContainText(`${option.plan.speed.toFixed(2)} m/s`)
    await expect(panel.getByTestId('house-controls')).toContainText(`${data.delivered.speed.toFixed(2)} m/s`)
    await expect(panel.getByTestId('house-topspin').locator('td')).toHaveText([`${(data.requested.topSpin * 100).toFixed(1)}%`, `${(data.delivered.topSpin * 100).toFixed(1)}%`])
    await expect(panel.getByTestId('house-english').locator('td')).toHaveText([`${data.requested.sideSpin.toFixed(1)} rad/s`, `${data.delivered.sideSpin.toFixed(1)} rad/s`])
    await expect(panel.getByTestId(`house-route-${ball.ballId}-${option.label}`).locator('td')).toHaveText([`${(option.plan.topSpin * 100).toFixed(0)}%`, `${(data.finishShift * 100).toFixed(1)} cm`])
    await expect(panel.getByTestId('house-shift')).toContainText(`${(data.finishShift * 100).toFixed(1)} cm`)
    for (const [i, variant] of data.variants.entries()) {
      await panel.getByRole('button', { name: variant.label, exact: true }).click()
      await expect(panel.getByRole('status')).toContainText(`${(variant.scenario.conditions!.cue!.spin * 100).toFixed(0)}% spin delivery`)
      for (const b of variant.simulation.finalBalls) {
        const g = panel.getByTestId(`house-ball-${b.id}`)
        if (b.pocketed) { await expect(g).toHaveCount(0); continue }
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(b.position.x, 9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(b.position.y, 9)
      }
      for (const [j, path] of [variant.simulation.cuePath, variant.simulation.objectPath].entries()) {
        const points = (await panel.getByTestId(`house-path-${j}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(path.length)
        for (const [k, point] of path.entries()) { expect(points[k][0]).toBeCloseTo(point.x, 9); expect(points[k][1]).toBeCloseTo(point.y, 9) }
      }
      const row = panel.getByTestId(`house-outcome-${i}`).locator('td')
      await expect(row).toHaveText([variant.outcome.legalPot ? 'Yes' : 'No', variant.simulation.scratch ? 'Yes' : 'No', `${(variant.outcome.error * 100).toFixed(1)} cm`])
      expect(Number(await panel.getByTestId('house-target').getAttribute('cx'))).toBeCloseTo(option.plan.target.x, 9)
      expect(Number(await panel.getByTestId('house-target').getAttribute('cy'))).toBeCloseTo(option.plan.target.y, 9)
    }
  }
  await panel.getByTestId('house-topspin').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/house-comparison-${mobile ? 'mobile' : 'desktop'}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 96', exact: true })).toBeVisible()
})
