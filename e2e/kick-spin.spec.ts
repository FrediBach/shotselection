import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { kickSpinEvidence } from '../src/engine/kick-spin'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`adjust kick aim for spin on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 53, level: 54, score: 0, rounds: 53, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(54, 54 * 919), { regenerate: false }), x = p.kickSpin!
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== x.referenceId)!
  const e = kickSpinEvidence(p.scenario, reference.plan, x)!
  await page.goto('/'); await startLevel(page, 54)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Kick spin comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Kick spin prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Keep the aim', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'Keeping the aim loses the pot' : 'This spin change needs an aim correction.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference finish ${reference.label}.` : 'You chose another finish')
  await expect(panel).toContainText(`aim by ${e.aimChange.toFixed(1)}°`)
  await expect(panel).toContainText(`${(e.shift * 100).toFixed(1)} cm along the same rail`)
  await expect(panel).toContainText(`differ by ${e.exitAngle.toFixed(1)}°`)
  await expect(panel).toContainText(`difference is only ${e.immediateAngle.toFixed(1)}°`)
  await expect(panel).toContainText('not evidence of a different instantaneous reflection angle')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img', { name: 'Spin-only comparison: first 20 cm after aligned rebounds' }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-spin-inset-${mobile ? 'mobile' : 'desktop'}.png` })
  for (const [key, title, simulation, exit] of [
    ['reference', `Reference finish ${reference.label}`, x.reference, e.reference],
    ['spin', 'Change spin only', x.spinOnly, e.spinOnly],
    ['corrected', 'Correct the aim', x.corrected, e.corrected],
  ] as const) {
    const xy = (await panel.getByTestId(`kick-spin-rebound-${key}`).getAttribute('transform'))!.slice(10, -1).split(' ').map(Number)
    expect(xy[0]).toBeCloseTo(exit.rebound.position.x, 9); expect(xy[1]).toBeCloseTo(exit.rebound.position.y, 9)
    const path = (await panel.getByTestId(`kick-spin-path-${key}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(simulation.cuePath.length)
    path.forEach(([a, b], i) => { expect(a).toBeCloseTo(simulation.cuePath[i].x, 9); expect(b).toBeCloseTo(simulation.cuePath[i].y, 9) })
    if (key !== 'corrected') {
      const inset = (await panel.getByTestId(`kick-spin-exit-${key}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(inset.length).toBe(exit.path.length)
      inset.forEach(([a, b], i) => { expect(a).toBeCloseTo(exit.path[i].x - exit.rebound.position.x, 9); expect(b).toBeCloseTo(exit.path[i].y - exit.rebound.position.y, 9) })
    }
    await panel.getByRole('img', { name: `${title}: actual approach, rebound and outcome` }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-spin-${key}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Adjust the aim', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: this spin change needs an aim correction.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 55', exact: true })).toBeVisible()
})
