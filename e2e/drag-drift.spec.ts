import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { simulateShot } from '../src/engine/physics'
import { compareDragDrift } from '../src/engine/drag-drift'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare coupled drag and drift on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 97, level: 98, score: 0, rounds: 97, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(98, 98 * 919))
  await page.goto('/'); await startLevel(page, 98)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Drag and drift comparison', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: 'Reduce pace', exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Both faults', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const ball of prepared.balls) for (const option of ball.options) {
    const experiment = compareDragDrift(prepared.scenario, option.plan, simulateShot(prepared.scenario, option.plan))!
    await panel.getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Both faults', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByTestId('drag-controls')).toContainText(`${option.plan.speed.toFixed(2)} m/s`)
    await expect(panel.getByRole('button', { name: 'Original pace', exact: true })).toHaveAttribute('aria-pressed', 'true')
    for (const [paceIndex, data] of experiment.entries()) {
      await panel.getByRole('button', { name: data.label, exact: true }).click()
      await expect(panel.getByTestId('drag-controls')).toContainText(`${data.plan.speed.toFixed(2)} m/s`)
      await expect(panel.getByTestId(`drag-pace-${paceIndex}`).locator('td')).toHaveText([data.variants[0].outcome.legalPot ? 'Yes' : 'No', `${(data.variants[0].outcome.error * 100).toFixed(1)} cm`])
    for (const [i, variant] of data.variants.entries()) {
      await panel.getByRole('button', { name: variant.label, exact: true }).click()
      await expect(panel.getByRole('status')).toContainText(`${variant.label} · ${data.label}`)
      for (const b of variant.simulation.finalBalls) {
        const g = panel.getByTestId(`drag-ball-${b.id}`)
        if (b.pocketed) { await expect(g).toHaveCount(0); continue }
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(b.position.x, 9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(b.position.y, 9)
      }
      for (const [j, path] of [variant.simulation.cuePath, variant.simulation.objectPath].entries()) {
        const points = (await panel.getByTestId(`drag-path-${j}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(path.length)
        for (const [k, point] of path.entries()) { expect(points[k][0]).toBeCloseTo(point.x, 9); expect(points[k][1]).toBeCloseTo(point.y, 9) }
      }
      const row = panel.getByTestId(`drag-outcome-${i}`).locator('td')
      await expect(row).toHaveText([variant.outcome.legalPot ? 'Yes' : 'No', variant.simulation.scratch ? 'Yes' : 'No', `${(variant.outcome.error * 100).toFixed(1)} cm`])
      expect(Number(await panel.getByTestId('drag-target').getAttribute('cx'))).toBeCloseTo(option.plan.target.x, 9)
      expect(Number(await panel.getByTestId('drag-target').getAttribute('cy'))).toBeCloseTo(option.plan.target.y, 9)
    }
  }
  }
  await expect(panel.getByRole('button', { name: 'Increase pace', exact: true })).toBeDisabled()
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByTestId('drag-prediction')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Increase pace', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByTestId('drag-prediction')).toContainText('Your prediction matches')
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/drag-comparison-${mobile ? 'mobile' : 'desktop'}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 99', exact: true })).toBeVisible()
})
