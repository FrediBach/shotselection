import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { kickPaceEvidence, reboundSpeed } from '../src/engine/kick-pace'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`budget kick pace on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 52, level: 53, score: 0, rounds: 52, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(53, 53 * 919), { regenerate: false }), x = p.kickPace!
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== x.referenceId)!
  const e = kickPaceEvidence(p.scenario, reference.plan, x.reference, x.weakPlan, x.weak)!
  await page.goto('/'); await startLevel(page, 53)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Kick pace comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Kick pace prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel).toContainText('preserve the same actual starting rotation')
  if (mobile) await predictions.getByRole('button', { name: 'Reaches ball 1', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'It reaches the cushion, but stops before ball 1.' : 'The weaker attempt stops before ball 1.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference finish ${reference.label}.` : 'You chose another finish')
  await expect(panel).toContainText(`${(e.gap * 100).toFixed(1)} cm from ball 1`)
  await expect(panel).toContainText('does not isolate cushion loss from cloth loss')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [key, title, simulation, rebound, speed] of [
    ['reference', `Reference finish ${reference.label}`, x.reference, e.good, reference.plan.speed],
    ['weak', 'Weaker attempt', x.weak, e.weak, x.weakPlan.speed],
  ] as const) {
    const table = panel.getByRole('table', { name: `${title}: measured speeds` })
    expect(await table.locator('tbody td').allTextContents()).toEqual([speed, reboundSpeed(rebound.incoming), reboundSpeed(rebound.outgoing)].map(v => `${v.toFixed(2)} m/s`))
    expect(Number(await panel.getByTestId(`kick-pace-stop-${key}`).getAttribute('cx'))).toBeCloseTo(simulation.cueEnd.x, 9)
    expect(Number(await panel.getByTestId(`kick-pace-stop-${key}`).getAttribute('cy'))).toBeCloseTo(simulation.cueEnd.y, 9)
    const path = (await panel.getByTestId(`kick-pace-path-${key}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(simulation.cuePath.length)
    path.forEach(([a, b], i) => { expect(a).toBeCloseTo(simulation.cuePath[i].x, 9); expect(b).toBeCloseTo(simulation.cuePath[i].y, 9) })
    await panel.getByRole('img', { name: `${title}: actual kick path and stopping point` }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-pace-${key}-${mobile ? 'mobile' : 'desktop'}.png` })
    await table.scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-pace-${key}-speeds-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Stops before ball 1', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: the weaker attempt stops before ball 1.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 54', exact: true })).toBeVisible()
})
