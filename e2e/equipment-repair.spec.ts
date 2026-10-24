import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`diagnose single equipment repairs on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(120000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 98, level: 99, score: 0, rounds: 98, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(99, 99 * 919))
  const selected = prepared.balls[0].options[2]
  const expected = analyzeRound(prepared, { ballId: selected.plan.ballId, optionId: selected.id }, { samples: 64, talents: DEFAULT_CHARACTER.talents }).equipmentRepairs!
  await page.goto('/'); await startLevel(page, 99)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Equipment repair diagnosis', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await panel.getByRole('group', { name: 'Equipment repair prediction' }).getByRole('button', { name: 'No repair changes it', exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Unchanged equipment', { timeout: 60000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Ball 1 · C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const prediction = panel.getByRole('group', { name: 'Equipment repair prediction' })
  const conditionButtons = panel.getByRole('group', { name: 'Inspect equipment repair' })
  for (const [i, variant] of expected.variants.entries()) {
    await conditionButtons.getByRole('button', { name: variant.label, exact: true }).click()
    await expect(panel.getByRole('status')).toContainText(variant.label)
    for (const ball of prepared.balls) for (const option of ball.options) {
      const shot = variant.shots.find(s => s.plan.id === option.id)!, original = expected.variants[0].shots.find(s => s.plan.id === option.id)!
      await expect(panel.getByTestId(`repair-row-${ball.ballId}-${option.label}`).locator('td')).toHaveText([(original.score * 100).toFixed(1), (shot.score * 100).toFixed(1), `${(shot.successRate * 100).toFixed(0)}%`])
      await expect(panel.getByTestId(`repair-row-${ball.ballId}-${option.label}`).locator('th')).toHaveText(`Ball ${ball.ballId} · ${option.label}${variant.winners.includes(option.id) ? ' ★' : ''}`)
      await panel.getByRole('group', { name: 'Inspect repaired stroke' }).getByRole('button', { name: `Ball ${ball.ballId} · ${option.label}`, exact: true }).click()
      for (const b of shot.nominal.finalBalls) {
        const g = panel.getByTestId(`repair-ball-${b.id}`)
        if (b.pocketed) { await expect(g).toHaveCount(0); continue }
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(b.position.x, 9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(b.position.y, 9)
      }
      for (const [j, path] of [shot.nominal.cuePath, shot.nominal.objectPath].entries()) {
        const points = (await panel.getByTestId(`repair-path-${j}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(points).toHaveLength(path.length)
        for (const [k, point] of path.entries()) { expect(points[k][0]).toBeCloseTo(point.x, 9); expect(points[k][1]).toBeCloseTo(point.y, 9) }
      }
      expect(Number(await panel.getByTestId('repair-target').getAttribute('cx'))).toBeCloseTo(option.plan.target.x, 9)
      expect(Number(await panel.getByTestId('repair-target').getAttribute('cy'))).toBeCloseTo(option.plan.target.y, 9)
    }
    if (i > 0) await expect(panel.getByRole('status')).toContainText(variant.changed ? 'set changes' : 'set stays the same')
  }
  await expect(prediction.getByRole('button').first()).toBeDisabled()
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByTestId('repair-prediction')).toHaveCount(0)
  const answer = expected.variants.slice(1).find(v => v.changed)?.label ?? 'No repair changes it'
  await prediction.getByRole('button', { name: answer, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByTestId('repair-prediction')).toContainText('Your prediction matches')
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/equipment-repair-${mobile ? 'mobile' : 'desktop'}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 100', exact: true })).toBeVisible()
})
