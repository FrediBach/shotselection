import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { kickSequenceEvidence } from '../src/engine/kick-sequence'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`trace two rebounds on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 56, level: 57, score: 0, rounds: 56, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(57, 57 * 919), { regenerate: false }), x = p.kickSequence!
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== x.referenceId)!
  const e = kickSequenceEvidence(p.scenario, x.simulation)!, wrong = e.order === 'A → B' ? 'B → A' : 'A → B'
  await page.goto('/'); await startLevel(page, 57)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Two-cushion sequence', exact: true })
  const predictions = panel.getByRole('group', { name: 'Rebound order prediction' })
  await expect(panel.getByRole('img')).toHaveCount(1)
  await expect(panel.getByTestId('sequence-rebound-1')).toHaveText(e.firstLabel)
  await expect(panel.getByTestId('sequence-rebound-2')).toHaveText(e.secondLabel)
  await expect(panel.getByTestId('sequence-object-path')).toHaveCount(0)
  await expect(panel.getByTestId('sequence-screen')).toHaveCount(8)
  for (const screen of await panel.getByTestId('sequence-screen').all()) await expect(screen).toHaveAttribute('fill-opacity', '.25')
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-sequence-preview-${mobile ? 'mobile' : 'desktop'}.png` })
  if (mobile) await predictions.getByRole('button', { name: wrong, exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? `Trace from the cue ball: ${e.order}.` : `The order is ${e.order}.`, { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'You chose this reference finish.' : 'You chose another finish')
  await expect(panel.getByTestId('sequence-rebound-1')).toHaveText('R1')
  await expect(panel.getByTestId('sequence-rebound-2')).toHaveText('R2')
  await expect(panel.getByTestId('sequence-object-path')).toHaveCount(1)
  for (const time of [e.first.time, e.second.time, e.contact.time]) await expect(panel).toContainText(`${time.toFixed(2)} s`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  for (let i = 0; i < 3; i++) {
    const path = (await panel.getByTestId(`sequence-leg-${i + 1}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(e.legs[i].length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(e.legs[i][j].x, 9); expect(b).toBeCloseTo(e.legs[i][j].y, 9) })
  }
  for (const [i, rebound] of [e.first, e.second].entries()) {
    const xy = (await panel.getByTestId(`sequence-rebound-${i + 1}`).getAttribute('transform'))!.slice(10, -1).split(' ').map(Number)
    expect(xy[0]).toBeCloseTo(rebound.position.x, 9); expect(xy[1]).toBeCloseTo(rebound.position.y, 9)
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-sequence-result-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByTestId('sequence-rebound-1')).toHaveText(e.firstLabel)
  await expect(panel.getByTestId('sequence-object-path')).toHaveCount(0)
  await predictions.getByRole('button', { name: e.order, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText(`Correct: ${e.order}.`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 58', exact: true })).toBeVisible()
})
