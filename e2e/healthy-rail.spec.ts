import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { simulateShot } from '../src/engine/physics'
import { compareHealthyRail } from '../src/engine/healthy-rail'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare weak and healthy cushions on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 93, level: 94, score: 0, rounds: 93, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(94, 94 * 919))
  await page.goto('/'); await startLevel(page, 94)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Healthy rail comparison', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Weak cushion', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const ball of prepared.balls) for (const option of ball.options) {
    const data = compareHealthyRail(prepared.scenario, option.plan, simulateShot(prepared.scenario, option.plan))!
    await panel.getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Weak cushion', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByTestId('rail-controls')).toContainText(`${option.plan.speed.toFixed(2)} m/s`)
    await expect(panel.getByTestId('rail-shift')).toContainText(`${(data.finishShift * 100).toFixed(1)} cm`)
    for (const [i, variant] of data.variants.entries()) {
      await panel.getByRole('button', { name: variant.label, exact: true }).click()
      await expect(panel.getByRole('status')).toContainText(`restitution ${variant.scenario.conditions!.cushions![0].restitution.toFixed(2)}`)
      for (const b of variant.simulation.finalBalls) {
        const g = panel.getByTestId(`rail-ball-${b.id}`)
        if (b.pocketed) { await expect(g).toHaveCount(0); continue }
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(b.position.x, 9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(b.position.y, 9)
      }
      for (const [j, path] of [variant.simulation.cuePath, variant.simulation.objectPath].entries()) {
        const points = (await panel.getByTestId(`rail-path-${j}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(path.length)
        for (const [k, point] of path.entries()) { expect(points[k][0]).toBeCloseTo(point.x, 9); expect(points[k][1]).toBeCloseTo(point.y, 9) }
      }
      if (data.matched) {
        await expect(panel.getByTestId('rail-no-match')).toHaveCount(0)
        await expect(panel.getByTestId('rail-measurement')).toContainText(`${variant.event!.time.toFixed(3)} s`)
        await expect(panel.getByTestId('rail-measurement')).toContainText(`${variant.outgoingSpeed!.toFixed(2)} m/s`)
        await expect(panel.getByTestId('rail-measurement')).toContainText(`${(variant.returnLength * 100).toFixed(1)} cm`)
        const ring = panel.getByTestId('rail-rebound')
        expect(Number(await ring.getAttribute('cx'))).toBeCloseTo(variant.event!.position.x, 9)
        expect(Number(await ring.getAttribute('cy'))).toBeCloseTo(variant.event!.position.y, 9)
        const points = (await panel.getByTestId('rail-return').getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(variant.returnPath.length)
        for (const [j, point] of variant.returnPath.entries()) { expect(points[j][0]).toBeCloseTo(point.x, 9); expect(points[j][1]).toBeCloseTo(point.y, 9) }
        if (i === 1) {
          await panel.getByRole('img').scrollIntoViewIfNeeded()
          await page.locator('.shot-panel').screenshot({ path: `/tmp/healthy-rail-${mobile ? 'mobile' : 'desktop'}.png` })
        }
      } else {
        await expect(panel.getByTestId('rail-no-match')).toBeVisible()
        await expect(panel.getByTestId('rail-return')).toHaveCount(0)
        await expect(panel.getByTestId('rail-rebound')).toHaveCount(0)
      }
      const row = panel.getByTestId(`rail-outcome-${i}`).locator('td')
      await expect(row).toHaveText([variant.outcome.legalPot ? 'Yes' : 'No', variant.simulation.scratch ? 'Yes' : 'No', `${(variant.outcome.error * 100).toFixed(1)} cm`])
      expect(Number(await panel.getByTestId('rail-target').getAttribute('cx'))).toBeCloseTo(option.plan.target.x, 9)
      expect(Number(await panel.getByTestId('rail-target').getAttribute('cy'))).toBeCloseTo(option.plan.target.y, 9)
    }
  }
  await panel.getByRole('img').scrollIntoViewIfNeeded()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 95', exact: true })).toBeVisible()
})
