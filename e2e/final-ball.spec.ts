import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { finalBallComparison } from '../src/engine/final-ball'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`final ball has no position target on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 78, level: 79, score: 0, rounds: 78, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(79, 79 * 919))
  const r = analyzeRound(p, { ballId: 1, optionId: p.balls[0].options[2].id }, { samples: 64 }), data = finalBallComparison(p, r)!
  await page.goto('/'); await startLevel(page, 79)
  const table = page.getByRole('group', { name: 'Interactive pool table, top view', exact: true })
  await expect(table.getByRole('button', { name: /^Table ball/ })).toHaveCount(1)
  await expect(page.getByTestId('position-zone')).toHaveCount(0)
  await expect(page.getByTestId('next-ball-marker')).toHaveCount(0)
  await expect(page.locator('.table-legend')).not.toContainText('Desired finish')
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Final ball objective comparison', exact: true })
  await expect(panel.getByRole('table')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: 'Fails the target', exact: true }).click()
  await page.getByRole('button', { name: 'Choose stroke C', exact: true }).click()
  await expect(table.locator('g[stroke="#dce9b6"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('The legal final pot still wins', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [column, shot] of data.shots.entries()) for (const [row, count] of [shot.wins, shot.restricted, shot.outside].entries()) await expect(panel.getByTestId(`final-ball-row-${row}`).getByRole('cell').nth(column)).toHaveText(`${count}/64`)
  for (const button of await panel.getByRole('group', { name: 'Final pot prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  const diagram = panel.getByRole('img', { name: 'Final pot with optional imagined target' })
  await expect(diagram.locator('circle[stroke-dasharray]')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Show imagined target', exact: true }).click()
  const zone = diagram.locator('circle[stroke-dasharray]')
  expect(Number(await zone.getAttribute('r'))).toBe(data.radius)
  expect(Number(await zone.getAttribute('cx'))).toBeCloseTo(data.target.x, 9)
  expect(Number(await zone.getAttribute('cy'))).toBeCloseTo(data.target.y, 9)
  await expect(table.locator('g[stroke="#dce9b6"]')).toHaveCount(0)
  for (const option of p.balls[0].options) {
    await panel.getByRole('button', { name: `Inspect stroke ${option.label}`, exact: true }).click()
    const shot = r.candidates.find(s => s.plan.id === option.id)!
    for (const [index, path] of [shot.nominal.cuePath, shot.nominal.objectPath].entries()) {
      const actual = (await diagram.locator('polyline').nth(index).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(actual).toHaveLength(path.length)
      for (const [i, point] of path.entries()) { expect(actual[i][0]).toBeCloseTo(point.x, 9); expect(actual[i][1]).toBeCloseTo(point.y, 9) }
    }
  }
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/final-ball-${mobile ? 'mobile' : 'desktop'}.png` })
  await page.getByRole('button', { name: 'Explain my shot', exact: true }).click()
  const feedback = page.getByRole('dialog')
  await expect(feedback).toContainText('No next ball, no position target')
  await expect(feedback.getByRole('rowheader', { name: 'In intended finish', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to comparison', exact: true }).click()
  const tolerance = page.getByRole('region', { name: 'Shot tolerance comparison', exact: true })
  await expect(tolerance).toContainText('Final ball · no position target')
  await expect(tolerance.locator('.margin-value')).toHaveCount(12, { timeout: 30000 })
  await expect(tolerance.locator('.tolerance-volume-legend')).toContainText('Final-ball win')
  await expect(tolerance.locator('.tolerance-volume-legend')).not.toContainText('Pot + target')
  await expect(tolerance.locator('svg desc')).toContainText('a legal final pot without a scratch')
  await expect(tolerance.locator('.tolerance-volume-point-success title').first()).toContainText('Legal final pot without a scratch')
  const margins = await tolerance.locator('.margin-value').allTextContents()
  await tolerance.getByRole('button', { name: 'Legal pot', exact: true }).click()
  expect(await tolerance.locator('.margin-value').allTextContents()).toEqual(margins)
  await tolerance.getByRole('button', { name: 'Final-ball win', exact: true }).click()
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Still wins', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  await expect(panel.getByRole('button', { name: 'Show imagined target', exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Inspect stroke A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 80', exact: true })).toBeVisible()
})
