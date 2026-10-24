import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { kickFinishEvidence } from '../src/engine/kick-finish'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`read kick finish on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 55, level: 56, score: 0, rounds: 55, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(56, 56 * 919), { regenerate: false }), x = p.kickFinish!
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== x.referenceId)!
  const e = kickFinishEvidence(p.scenario, reference.plan, x)!, safe = p.scenario.seed % 2 ? 1 : 2, risky = 3 - safe
  await page.goto('/'); await startLevel(page, 56)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Kick finish comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Kick finish prediction' })
  await expect(panel.getByRole('img')).toHaveCount(2)
  await expect(panel.getByTestId('kick-finish-departure-scratch')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Route ${safe}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? `route ${risky} scratches.` : `Route ${risky} scratches.`, { timeout: 30000 })
  await expect(panel).toContainText(`${e.approachAngle.toFixed(1)}°`)
  await expect(panel).toContainText(`${e.launchAngle.toFixed(1)}°`)
  await expect(panel).toContainText(mobile ? `You chose reference finish ${reference.label}.` : 'You chose another finish')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [key, evidence, simulation, n] of [['reference', e.reference, x.reference, safe], ['scratch', e.scratched, x.scratched, risky]] as const) {
    for (const [part, expected] of [['approach', evidence.approach], ['departure', evidence.departure]] as const) {
      const actual = (await panel.getByTestId(`kick-finish-${part}-${key}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(actual.length).toBe(expected.length)
      actual.forEach(([a, b], i) => { expect(a).toBeCloseTo(expected[i].x, 9); expect(b).toBeCloseTo(expected[i].y, 9) })
    }
    expect(Number(await panel.getByTestId(`kick-finish-end-${key}`).getAttribute('cx'))).toBeCloseTo(simulation.cueEnd.x, 9)
    expect(Number(await panel.getByTestId(`kick-finish-end-${key}`).getAttribute('cy'))).toBeCloseTo(simulation.cueEnd.y, 9)
    await panel.getByRole('img', { name: `Route ${n}: kick approach and departure`, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-finish-${key}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByTestId('kick-finish-departure-scratch')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Route ${risky}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText(`Correct: route ${risky} scratches.`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 57', exact: true })).toBeVisible()
})
