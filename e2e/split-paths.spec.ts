import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { splitPathsReplay } from '../src/engine/split-paths'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect both split paths on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 81, level: 82, score: 0, rounds: 81, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(82, 82 * 919))
  await page.goto('/'); await startLevel(page, 82)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Split shot paths', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose stroke C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Ball 1 contacts ball 2', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Stroke C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const option of p.balls[0].options) {
    const sim = analyzeShot(p.scenario, option.plan, 8).nominal, replay = splitPathsReplay(p.scenario, sim)!
    await panel.getByRole('button', { name: `Stroke ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('status')).toContainText(`${replay.transfer.time.toFixed(3)} s`)
    await expect(panel.locator('polyline')).toHaveCount(0)
    expect((await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number).slice(2)).toEqual([.7, .5])
    for (const ball of replay.transfer.balls!) {
      const circle = panel.getByTestId(`split-ball-${ball.id}`).locator('circle')
      expect(Number(await circle.getAttribute('cx'))).toBeCloseTo(ball.position.x, 9)
      expect(Number(await circle.getAttribute('cy'))).toBeCloseTo(ball.position.y, 9)
    }
    await panel.getByRole('button', { name: 'Reveal outgoing paths', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Both balls', exact: true })).toHaveAttribute('aria-pressed', 'true')
    for (const path of replay.paths) {
      const line = panel.getByTestId(`split-path-${path.ballId}`)
      const actual = (await line.getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(actual).toHaveLength(path.points.length)
      for (const [i, point] of path.points.entries()) { expect(actual[i][0]).toBeCloseTo(point.x, 9); expect(actual[i][1]).toBeCloseTo(point.y, 9) }
      await expect(line).toHaveAttribute('stroke', path.ballId === 1 ? '#ffc16e' : '#7de3ef')
    }
    await expect(panel.getByTestId('split-path-1')).toHaveAttribute('stroke-dasharray', '.035 .018')
    for (const ballId of [1, 2]) {
      await panel.getByRole('button', { name: `Ball ${ballId} only`, exact: true }).click()
      await expect(panel.getByTestId(`split-path-${ballId}`)).toHaveCount(1)
      await expect(panel.getByTestId(`split-path-${3-ballId}`)).toHaveCount(0)
    }
    await panel.getByRole('button', { name: 'Both balls', exact: true }).click()
    if (option.label === 'C') {
      await panel.getByRole('img').scrollIntoViewIfNeeded()
      await page.locator('.shot-panel').screenshot({ path: `/tmp/split-paths-${mobile ? 'mobile' : 'desktop'}.png` })
    }
    await panel.getByRole('button', { name: 'Settled result', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('both pots complete the trick')
    await expect(panel.getByTestId('split-ball-1')).toHaveCount(0)
    await expect(panel.getByTestId('split-ball-2')).toHaveCount(0)
    await expect(panel.locator('polyline')).toHaveCount(2)
    await panel.getByRole('button', { name: 'Contact close-up', exact: true }).click()
    await expect(panel.locator('polyline')).toHaveCount(0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 83', exact: true })).toBeVisible()
})
