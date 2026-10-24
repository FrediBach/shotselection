import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { compareDirtyContact } from '../src/engine/dirty-contact'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare clean and dirty contact responses on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 95, level: 96, score: 0, rounds: 95, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(96, 96 * 919))
  await page.goto('/'); await startLevel(page, 96)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Dirty ball contact comparison', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Dirty contact', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const ball of prepared.balls) for (const option of ball.options) {
    const data = compareDirtyContact(prepared.scenario, option.plan, analyzeShot(prepared.scenario, option.plan, 8).nominal)!
    await panel.getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Dirty contact', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('button', { name: 'Show complete route', exact: true })).toBeVisible()
    await expect(panel.getByTestId('dirty-differences')).toContainText(`${data.speedDifference.toFixed(3)} m/s`)
    await expect(panel.getByTestId('dirty-differences')).toContainText(`${data.angleDifference.toFixed(2)}°`)
    for (const [i, variant] of data.variants.entries()) {
      await panel.getByRole('button', { name: variant.label, exact: true }).click()
      await expect(panel.getByRole('status')).toContainText(`${variant.contact.time.toFixed(3)} s`)
      await expect(panel.getByTestId(`dirty-speed-${i}`).locator('td')).toHaveText(`${variant.speed.toFixed(3)} m/s`)
      const line = panel.getByTestId(`dirty-direction-${i}`).locator('line'), origin = variant.contact.positions[variant.contact.ballIds.indexOf(ball.ballId)]
      const values = [origin.x, origin.y, origin.x + variant.outgoing.x / variant.speed * .22, origin.y + variant.outgoing.y / variant.speed * .22]
      for (const [j, attr] of ['x1', 'y1', 'x2', 'y2'].entries()) expect(Number(await line.getAttribute(attr))).toBeCloseTo(values[j], 9)
      expect((await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number).slice(2)).toEqual([.7, .5])
      for (const b of variant.contact.balls!) {
        const circle = panel.getByTestId(`dirty-ball-${b.id}`).locator('circle')
        expect(Number(await circle.getAttribute('cx'))).toBeCloseTo(b.position.x, 9)
        expect(Number(await circle.getAttribute('cy'))).toBeCloseTo(b.position.y, 9)
      }
      if (i === 0 && option.label === 'C' && ball.ballId === 2) {
        await panel.getByRole('img').scrollIntoViewIfNeeded()
        await page.locator('.shot-panel').screenshot({ path: `/tmp/dirty-contact-${mobile ? 'mobile' : 'desktop'}.png` })
      }
      await panel.getByRole('button', { name: 'Show complete route', exact: true }).click()
      await expect(panel.getByRole('img')).toHaveAttribute('viewBox', '-.08 -.08 2.70 1.43')
      await expect(panel.getByTestId('dirty-direction-0')).toHaveCount(0)
      for (const b of variant.simulation.finalBalls) {
        const g = panel.getByTestId(`dirty-ball-${b.id}`)
        if (b.pocketed) { await expect(g).toHaveCount(0); continue }
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(b.position.x, 9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(b.position.y, 9)
      }
      for (const [j, path] of [variant.simulation.cuePath, variant.simulation.objectPath].entries()) {
        const points = (await panel.getByTestId(`dirty-path-${j}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(path.length)
        for (const [k, point] of path.entries()) { expect(points[k][0]).toBeCloseTo(point.x, 9); expect(points[k][1]).toBeCloseTo(point.y, 9) }
      }
      await panel.getByRole('button', { name: 'Show contact close-up', exact: true }).click()
    }
    await panel.getByRole('button', { name: 'Show complete route', exact: true }).click()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 97', exact: true })).toBeVisible()
})
