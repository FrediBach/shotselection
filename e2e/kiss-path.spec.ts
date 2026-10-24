import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { kissPathReplay } from '../src/engine/kiss-path'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect the kiss redirection on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 82, level: 83, score: 0, rounds: 82, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(83, 83 * 919))
  await page.goto('/'); await startLevel(page, 83)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Kiss shot redirection', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose stroke C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Paused at the kiss', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Stroke C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const option of p.balls[0].options) {
    const sim = analyzeShot(p.scenario, option.plan, 8).nominal, replay = kissPathReplay(p.scenario, sim)!
    await panel.getByRole('button', { name: `Stroke ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('status')).toContainText(`${replay.contact.time.toFixed(3)} s`)
    await expect(panel.getByTestId('kiss-outgoing')).toHaveCount(0)
    expect((await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number).slice(2)).toEqual([.7, .5])
    for (const ball of replay.contact.balls!) {
      const circle = panel.getByTestId(`kiss-ball-${ball.id}`).locator('circle').first()
      expect(Number(await circle.getAttribute('cx'))).toBeCloseTo(ball.position.x, 9)
      expect(Number(await circle.getAttribute('cy'))).toBeCloseTo(ball.position.y, 9)
    }
    await panel.getByRole('button', { name: 'Reveal outgoing path', exact: true }).click()
    await expect(panel.getByRole('img')).toHaveAttribute('viewBox', '-.08 -.08 2.70 1.43')
    for (const [name, path] of [['incoming', replay.incoming], ['outgoing', replay.outgoing]] as const) {
      const actual = (await panel.getByTestId(`kiss-${name}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(actual).toHaveLength(path.length)
      for (const [i, point] of path.entries()) { expect(actual[i][0]).toBeCloseTo(point.x, 9); expect(actual[i][1]).toBeCloseTo(point.y, 9) }
    }
    await expect(panel.getByTestId('kiss-incoming')).toHaveAttribute('stroke-dasharray', '.025 .015')
    await expect(panel.getByTestId('kiss-outgoing')).toHaveAttribute('stroke', '#ffc16e')
    await panel.getByRole('button', { name: 'Zoom at contact', exact: true }).click()
    const viewport = (await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number)
    expect(viewport.slice(2)).toEqual([.7, .5]); expect(viewport[0]).toBeCloseTo(replay.outgoing[0].x - .35, 9)
    if (option.label === 'C') {
      await panel.getByRole('img').scrollIntoViewIfNeeded()
      await page.locator('.shot-panel').screenshot({ path: `/tmp/kiss-path-${mobile ? 'mobile' : 'desktop'}.png` })
    }
    await panel.getByRole('button', { name: 'Show whole route', exact: true }).click()
    await expect(panel.getByRole('img')).toHaveAttribute('viewBox', '-.08 -.08 2.70 1.43')
    await panel.getByRole('button', { name: 'Settled result', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('the kiss pot completes the trick')
    await expect(panel.getByTestId('kiss-ball-1')).toHaveCount(0)
    await expect(panel.getByTestId('kiss-ball-2')).toHaveCount(1)
    await panel.getByRole('button', { name: 'Pause at the kiss', exact: true }).click()
    await expect(panel.getByTestId('kiss-outgoing')).toHaveCount(0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 84', exact: true })).toBeVisible()
})
