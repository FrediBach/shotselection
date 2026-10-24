import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { analyzeRound } from '../src/engine/analysis'
import { plannedMovementEvidence } from '../src/engine/planned-movement'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`planned blocker movement on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 76, level: 77, score: 0, rounds: 76, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(77, 77 * 919), { regenerate: false })
  const result = analyzeRound(p, { ballId: 1, optionId: p.balls[0].options[2].id }, { samples: 64 })
  const e = result.candidates.map(s => plannedMovementEvidence(p.scenario, { plan: s.plan, simulation: s.nominal })).find(e => e)!
  await page.goto('/'); await startLevel(page, 77)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Planned blocker movement', exact: true })
  await expect(panel.getByRole('table')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: 'Still available', exact: true }).click()
  await page.getByRole('button', { name: 'Choose stroke C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Restoring ball 3 blocks the next shot', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [column, o] of p.balls[0].options.entries()) {
    const shot = result.candidates.find(s => s.plan.id === o.id)!
    const counts = [shot.movementTrials!.filter(t => t.contact).length, shot.movementTrials!.filter(t => t.opened).length, shot.trialSuccesses!.filter(Boolean).length]
    for (const [row, n] of counts.entries()) await expect(panel.getByTestId(`movement-row-${row}`).getByRole('cell').nth(column)).toHaveText(`${n}/64`)
  }
  for (const button of await panel.getByRole('group', { name: 'Blocker restoration prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  const diagram = panel.getByRole('img', { name: 'Planned movement evidence' })
  await expect(diagram.locator('polyline')).toHaveCount(0)
  for (const [name, balls, sim] of [
    ['Opening stroke', p.scenario.balls, e.opening.simulation],
    ['Next pot', e.scenario.balls, e.simulation],
    ['Restore blocker', e.restored.balls, e.blocked],
  ] as const) {
    await panel.getByRole('button', { name, exact: true }).click()
    for (const [index, path] of [sim.cuePath, sim.objectPath].entries()) {
      const actual = (await diagram.locator('polyline').nth(index).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(actual).toHaveLength(path.length)
      for (const [i, point] of path.entries()) {
        expect(actual[i][0]).toBeCloseTo(point.x, 9)
        expect(actual[i][1]).toBeCloseTo(point.y, 9)
      }
    }
    for (const b of balls) {
      const circle = diagram.locator('g').filter({ has: page.locator('text', { hasText: new RegExp(`^${b.id || ''}$`) }) }).locator('circle')
      expect(Number(await circle.getAttribute('cx'))).toBeCloseTo(b.position.x, 10)
      expect(Number(await circle.getAttribute('cy'))).toBeCloseTo(b.position.y, 10)
    }
  }
  await diagram.scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/movement-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel.getByRole('img')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Blocked', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  await expect(panel.getByRole('button', { name: 'Settled layout', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 78', exact: true })).toBeVisible()
})
