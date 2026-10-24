import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { drawReturnReplay } from '../src/engine/draw-return'
import { verticalSpinDescription } from '../src/lib/shot-presentation'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect the draw reversal and return speed on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 85, level: 86, score: 0, rounds: 85, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(86, 86 * 919))
  await page.goto('/'); await startLevel(page, 86)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Draw return replay', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose stroke C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('First contact:', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Stroke C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const option of p.balls[0].options) {
    const sim = analyzeShot(p.scenario, option.plan, 8).nominal, data = drawReturnReplay(p.scenario, sim)!
    await panel.getByRole('button', { name: `Stroke ${option.label}`, exact: true }).click()
    await expect(panel.getByTestId('draw-controls')).toContainText(`${option.plan.speed.toFixed(2)} m/s · ${verticalSpinDescription(option.plan)}`)
    await expect(panel.getByTestId('draw-turn-marker')).toHaveCount(0)
    await expect(panel.getByTestId('draw-return-speed')).toHaveCount(0)
    for (const [phase, label] of ['First contact', 'Locate the turn', 'Return contact', 'Settled result'].entries()) {
      await panel.getByRole('button', { name: label, exact: true }).click()
      const balls = phase === 0 ? data.first.balls! : phase === 1 ? data.turn.balls : phase === 2 ? data.second.balls! : sim.finalBalls
      for (const ball of balls) {
        const g = panel.getByTestId(`draw-ball-${ball.id}`)
        if (ball.pocketed) { await expect(g).toHaveCount(0); continue }
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(ball.position.x, 9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(ball.position.y, 9)
      }
      if (phase > 0) {
        await expect(panel.getByTestId('draw-turn-note')).toContainText('approximately')
        await expect(panel.getByTestId('draw-turn-note')).toContainText(`${data.bracket[0].toFixed(3)}–${data.bracket[1].toFixed(3)} s`)
        const marker = (await panel.getByTestId('draw-turn-marker').getAttribute('d'))!.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
        expect(marker[0]).toBeCloseTo(data.turn.position.x-.04,9); expect(marker[1]).toBeCloseTo(data.turn.position.y,9)
        const expected = data.samples.slice(0, phase === 1 ? data.turnIndex+1 : undefined)
        const points = (await panel.getByTestId('draw-return-path').getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(expected.length)
        for (const [i,sample] of expected.entries()) { expect(points[i][0]).toBeCloseTo(sample.position.x,9); expect(points[i][1]).toBeCloseTo(sample.position.y,9) }
      }
      if (phase === 1) await expect(panel.getByRole('status')).toContainText(`${data.turn.time.toFixed(3)} s`)
      if (phase >= 2) await expect(panel.getByTestId('draw-return-speed')).toContainText(`${data.returnSpeed.toFixed(2)} m/s`)
      if (phase === 2 && option.label === 'C') {
        await panel.getByRole('img').scrollIntoViewIfNeeded()
        await page.locator('.shot-panel').screenshot({ path: `/tmp/draw-return-${mobile ? 'mobile' : 'desktop'}.png` })
      }
    }
    await expect(panel.getByRole('status')).toContainText('both pots complete the trick')
    await panel.getByRole('button', { name: 'First contact', exact: true }).click()
    await expect(panel.getByTestId('draw-return-path')).toHaveCount(0)
    await expect(panel.getByTestId('draw-return-speed')).toHaveCount(0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 87', exact: true })).toBeVisible()
})
