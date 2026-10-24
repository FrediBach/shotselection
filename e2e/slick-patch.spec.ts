import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { simulateShot } from '../src/engine/physics'
import { compareSlickPatch } from '../src/engine/slick-patch'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare slick and ordinary patches on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 96, level: 97, score: 0, rounds: 96, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(97, 97 * 919))
  await page.goto('/'); await startLevel(page, 97)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Slick patch comparison', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Slick patch', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const ball of prepared.balls) for (const option of ball.options) {
    const data = compareSlickPatch(prepared.scenario, option.plan, simulateShot(prepared.scenario, option.plan))!
    await panel.getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Slick patch', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByTestId('slick-controls')).toContainText(`${option.plan.speed.toFixed(2)} m/s`)
    await expect(panel.getByTestId('slick-shift')).toContainText(`${(data.finishShift * 100).toFixed(1)} cm`)
    for (const [i, variant] of data.variants.entries()) {
      await panel.getByRole('button', { name: variant.label, exact: true }).click()
      await expect(panel.getByRole('status')).toContainText(`${variant.scenario.conditions!.patches!.find(p => p.id === data.slick.id)!.friction.toFixed(2)}× friction in the pale area`)
      for (const b of variant.simulation.finalBalls) {
        const g = panel.getByTestId(`slick-ball-${b.id}`)
        if (b.pocketed) { await expect(g).toHaveCount(0); continue }
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(b.position.x, 9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(b.position.y, 9)
      }
      for (const [j, path] of [variant.simulation.cuePath, variant.simulation.objectPath].entries()) {
        const points = (await panel.getByTestId(`slick-path-${j}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(path.length)
        for (const [k, point] of path.entries()) { expect(points[k][0]).toBeCloseTo(point.x, 9); expect(points[k][1]).toBeCloseTo(point.y, 9) }
      }
      for (const patch of variant.scenario.conditions!.patches!) {
        const area = panel.getByTestId(`slick-area-${patch.id}`)
        expect(Number(await area.getAttribute('cx'))).toBeCloseTo(patch.center.x, 9)
        expect(Number(await area.getAttribute('cy'))).toBeCloseTo(patch.center.y, 9)
        expect(Number(await area.getAttribute('r'))).toBeCloseTo(patch.radius, 9)
      }
      for (const [j, route] of variant.routes.entries()) {
        for (const crossing of route.crossings) {
          const lines = panel.getByTestId(`slick-inside-${j}-${crossing.patch.id}`)
          await expect(lines).toHaveCount(crossing.segments.length)
          const coords = await lines.evaluateAll(elements => elements.map(e => ['x1', 'y1', 'x2', 'y2'].map(a => Number(e.getAttribute(a)))))
          for (const [k, [a, b]] of crossing.segments.entries()) for (const [n, value] of [a.x, a.y, b.x, b.y].entries()) expect(coords[k][n]).toBeCloseTo(value, 9)
        }
        const lengths = [true, false].map(isSlick => route.crossings.filter(c => (c.patch.id === data.slick.id) === isSlick).reduce((sum, c) => sum + c.length, 0))
        await expect(panel.getByTestId(`slick-length-${j}`).locator('td')).toHaveText(lengths.map(length => length > 0 ? `${(length * 100).toFixed(1)} cm` : 'No crossing'))
      }
      const row = panel.getByTestId(`slick-outcome-${i}`).locator('td')
      await expect(row).toHaveText([variant.outcome.legalPot ? 'Yes' : 'No', variant.simulation.scratch ? 'Yes' : 'No', `${(variant.outcome.error * 100).toFixed(1)} cm`])
      expect(Number(await panel.getByTestId('slick-target').getAttribute('cx'))).toBeCloseTo(option.plan.target.x, 9)
      expect(Number(await panel.getByTestId('slick-target').getAttribute('cy'))).toBeCloseTo(option.plan.target.y, 9)
    }
  }
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/slick-comparison-${mobile ? 'mobile' : 'desktop'}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 98', exact: true })).toBeVisible()
})
