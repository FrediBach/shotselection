import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare uncertainty robustness on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(180000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 99, level: 100, score: 0, rounds: 99, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(100, 100 * 919))
  const selected = prepared.balls[0].options[2]
  const expected = analyzeRound(prepared, { ballId: selected.plan.ballId, optionId: selected.id }, { samples: 64, talents: DEFAULT_CHARACTER.talents }).conditionRobustness!
  await page.goto('/'); await startLevel(page, 100)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Table condition robustness', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await panel.getByRole('group', { name: 'Robustness prediction' }).getByRole('button', { name: 'Predict Ball 1 · C', exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Reported conditions', { timeout: 60000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const prediction = panel.getByRole('group', { name: 'Robustness prediction' })
  for (const ball of prepared.balls) for (const option of ball.options) {
    const route = expected.routes.find(r => r.optionId === option.id)!
    await expect(panel.getByTestId(`robust-row-${ball.ballId}-${option.label}`).locator('td')).toHaveText([(route.reported * 100).toFixed(1), (route.worst * 100).toFixed(1), (route.best * 100).toFixed(1)])
    await expect(panel.getByTestId(`robust-row-${ball.ballId}-${option.label}`).locator('th')).toHaveText(`Ball ${ball.ballId} · ${option.label}${expected.robust.includes(option.id) ? ' ★' : ''}`)
    await panel.getByRole('group', { name: 'Inspect robust stroke' }).getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Reported conditions', exact: true })).toHaveAttribute('aria-pressed', 'true')
    for (const variant of expected.variants) {
      await panel.getByRole('group', { name: 'Inspect condition probe' }).getByRole('button', { name: variant.label, exact: true }).click()
      const shot = variant.shots.find(s => s.plan.id === option.id)!
      await expect(panel.getByRole('status')).toContainText(variant.label)
      await expect(panel.getByRole('status')).toContainText(`score ${(shot.score * 100).toFixed(1)}`)
      await expect(panel.getByRole('status')).toContainText(`success ${(shot.successRate * 100).toFixed(0)}% of 64 trials`)
      for (const b of shot.nominal.finalBalls) {
        const g = panel.getByTestId(`robust-ball-${b.id}`)
        if (b.pocketed) { await expect(g).toHaveCount(0); continue }
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(b.position.x, 9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(b.position.y, 9)
      }
      for (const [j, path] of [shot.nominal.cuePath, shot.nominal.objectPath].entries()) {
        const points = (await panel.getByTestId(`robust-path-${j}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(path.length)
        for (const [k, point] of path.entries()) { expect(points[k][0]).toBeCloseTo(point.x, 9); expect(points[k][1]).toBeCloseTo(point.y, 9) }
      }
      expect(Number(await panel.getByTestId('robust-target').getAttribute('cx'))).toBeCloseTo(option.plan.target.x, 9)
      expect(Number(await panel.getByTestId('robust-target').getAttribute('cy'))).toBeCloseTo(option.plan.target.y, 9)
    }
  }
  await expect(panel.getByTestId('robust-leaders')).toContainText(expected.reported.join('|') === expected.robust.join('|') ? 'criteria agree' : 'criteria prefer different')
  await expect(prediction.getByRole('button').first()).toBeDisabled()
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByTestId('robust-prediction')).toHaveCount(0)
  const winner = prepared.balls.flatMap(b => b.options.map(o => ({ ...o, ballId: b.ballId }))).find(o => o.id === expected.robust[0])!
  await prediction.getByRole('button', { name: `Predict Ball ${winner.ballId} · ${winner.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByTestId('robust-prediction')).toContainText('Your prediction matches')
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/condition-robustness-${mobile ? 'mobile' : 'desktop'}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'View course summary', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Course complete', exact: true })).toBeVisible()
})
