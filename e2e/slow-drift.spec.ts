import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { slowDriftReplay } from '../src/engine/slow-drift'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect slow cue drift on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 91, level: 92, score: 0, rounds: 91, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(92, 92 * 919))
  await page.goto('/'); await startLevel(page, 92)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Slow roll drift replay', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Slow cue segment', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const ball of prepared.balls) for (const option of ball.options) {
    const sim = analyzeShot(prepared.scenario, option.plan, 8).nominal
    const data = slowDriftReplay(prepared.scenario, sim)!
    await panel.getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('img')).toHaveAttribute('viewBox', '-.08 -.08 2.70 1.43')
    await expect(panel.getByRole('status')).toContainText(`${data.start.time.toFixed(3)}–${data.finish.time.toFixed(3)} s`)
    await expect(panel.getByRole('status')).toContainText(`${data.elapsed.toFixed(3)} s`)
    const paths = [['drift-slow-path', data.points], ['drift-reference', [data.points[0], data.reference]]] as const
    for (const [id, path] of paths) {
      const points = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(points).toHaveLength(path.length)
      for (const [i, point] of path.entries()) { expect(points[i][0]).toBeCloseTo(point.x, 9); expect(points[i][1]).toBeCloseTo(point.y, 9) }
    }
    for (const [i, p] of [data.points[0], data.points.at(-1)!].entries()) {
      const marker = panel.getByTestId(`drift-marker-${i}`).locator('circle')
      expect(Number(await marker.getAttribute('cx'))).toBeCloseTo(p.x, 9)
      expect(Number(await marker.getAttribute('cy'))).toBeCloseTo(p.y, 9)
    }
    const line = panel.getByTestId('drift-direction').locator('line'), magnitude = Math.hypot(data.nap.x, data.nap.y)
    expect(Number(await line.getAttribute('x2'))).toBeCloseTo(data.nap.x / magnitude * .08, 9)
    expect(Number(await line.getAttribute('y2'))).toBeCloseTo(data.nap.y / magnitude * .08, 9)
    await expect(panel.getByTestId('drift-measurement')).toContainText(`${data.intervals[0].speed.toFixed(3)} m/s`)
    await expect(panel.getByTestId('drift-measurement')).toContainText(`${data.intervals.at(-1)!.speed.toFixed(3)} m/s`)
    await expect(panel.getByTestId('drift-measurement')).toContainText(`${(Math.abs(data.sideways) * 100).toFixed(2)} cm`)
    await panel.getByRole('button', { name: 'Zoom slow segment', exact: true }).click()
    const box = (await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number)
    expect(box[2]).toBeGreaterThanOrEqual(.5); expect(box[3]).toBeGreaterThanOrEqual(.36)
    for (const point of [...data.points, data.reference]) {
      expect(point.x).toBeGreaterThan(box[0]); expect(point.x).toBeLessThan(box[0] + box[2])
      expect(point.y).toBeGreaterThan(box[1]); expect(point.y).toBeLessThan(box[1] + box[3])
    }
    if (ball.ballId === 2 && option.label === 'C') {
      await panel.getByRole('img').scrollIntoViewIfNeeded()
      await page.locator('.shot-panel').screenshot({ path: `/tmp/slow-drift-${mobile ? 'mobile' : 'desktop'}.png` })
    }
    await panel.getByRole('button', { name: 'Show full route', exact: true }).click()
    await expect(panel.getByRole('img')).toHaveAttribute('viewBox', '-.08 -.08 2.70 1.43')
    await panel.getByRole('button', { name: 'Zoom slow segment', exact: true }).click()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 93', exact: true })).toBeVisible()
})
