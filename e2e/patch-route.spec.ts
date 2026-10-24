import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { patchRouteReplay } from '../src/engine/patch-route'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect sticky patch crossings on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 92, level: 93, score: 0, rounds: 92, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(93, 93 * 919))
  await page.goto('/'); await startLevel(page, 93)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Sticky patch route replay', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Bright segments', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const ball of prepared.balls) for (const option of ball.options) {
    const sim = analyzeShot(prepared.scenario, option.plan, 8).nominal
    const data = patchRouteReplay(prepared.scenario, option.plan, sim)!
    await panel.getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('button', { name: 'All routes', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('status')).toContainText(`${data.contact.time.toFixed(3)} s`)
    for (const patch of data.patches) {
      const area = panel.getByTestId(`patch-area-${patch.id}`)
      expect(Number(await area.getAttribute('cx'))).toBeCloseTo(patch.center.x, 9)
      expect(Number(await area.getAttribute('cy'))).toBeCloseTo(patch.center.y, 9)
      expect(Number(await area.getAttribute('r'))).toBeCloseTo(patch.radius, 9)
    }
    for (const [i, route] of data.routes.entries()) {
      const points = (await panel.getByTestId(`patch-route-${i}`).locator('polyline').getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(points).toHaveLength(route.path.length)
      for (const [j, p] of route.path.entries()) { expect(points[j][0]).toBeCloseTo(p.x, 9); expect(points[j][1]).toBeCloseTo(p.y, 9) }
      const segments = route.crossings.flatMap(c => c.segments), lines = panel.getByTestId(`patch-inside-${i}`)
      await expect(lines).toHaveCount(segments.length)
      const coords = await lines.evaluateAll(elements => elements.map(e => ['x1', 'y1', 'x2', 'y2'].map(a => Number(e.getAttribute(a)))))
      for (const [j, [a, b]] of segments.entries()) for (const [k, value] of [a.x, a.y, b.x, b.y].entries()) expect(coords[j][k]).toBeCloseTo(value, 9)
      const length = route.crossings.reduce((sum, c) => sum + c.length, 0)
      await expect(panel.getByTestId(`patch-length-${i}`).locator('td')).toHaveText(length > 0 ? `${(length * 100).toFixed(1)} cm` : 'No crossing')
    }
    for (const [i, label] of ['Cue before contact', 'Cue after contact', 'Object route'].entries()) {
      await panel.getByRole('button', { name: label, exact: true }).click()
      for (let j = 0; j < 3; j++) await expect(panel.getByTestId(`patch-route-${j}`)).toHaveCount(i === j ? 1 : 0)
    }
    if (ball.ballId === 2 && option.label === 'C') {
      await panel.getByRole('button', { name: 'All routes', exact: true }).click()
      await panel.getByRole('img').scrollIntoViewIfNeeded()
      await page.locator('.shot-panel').screenshot({ path: `/tmp/patch-route-${mobile ? 'mobile' : 'desktop'}.png` })
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 94', exact: true })).toBeVisible()
})
