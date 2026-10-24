import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { simulateShot } from '../src/engine/physics'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`read kick contact side on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 51, level: 52, score: 0, rounds: 51, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(52, 52 * 919), { regenerate: false }), e = p.kickContact!
  const reference = p.balls[0].options.find(o => o.id === e.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== e.referenceId)!
  const nominal = simulateShot(p.scenario, reference.plan)
  const correct = p.scenario.seed % 2 === 0 ? 2 : 1
  await page.goto('/'); await startLevel(page, 52)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Kick contact comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Kick contact prediction' })
  await expect(panel.getByRole('img')).toHaveCount(3)
  await expect(panel.getByTestId('kick-contact-object-path')).toHaveCount(0)
  await expect(panel.getByTestId(`kick-contact-center-${correct}`)).toHaveCount(0)
  await expect(panel).toContainText('geometry sketches')
  if (mobile) await predictions.getByRole('button', { name: `Line ${3 - correct}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await panel.getByRole('img').last().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-contact-preview-${mobile ? 'mobile' : 'desktop'}.png` })
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? `Line ${correct}, rather than the center-directed line` : `Line ${correct} reaches the potting side.`, { timeout: 30000 })
  await expect(panel).toContainText(`${e.angle.toFixed(1)}°`)
  await expect(panel).toContainText(mobile ? `You chose reference finish ${reference.label}.` : `You chose a different finish`)
  await expect(panel).toContainText('center-directed sketch has no simulated outcome')
  for (const n of [1, 2]) {
    const end = n === correct ? e.ghost : e.centerHit
    expect(Number(await panel.getByTestId(`kick-contact-center-${n}`).getAttribute('cx'))).toBeCloseTo(end.x, 10)
    expect(Number(await panel.getByTestId(`kick-contact-center-${n}`).getAttribute('cy'))).toBeCloseTo(end.y, 10)
  }
  const drawn = (await panel.getByTestId('kick-contact-object-path').getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
  expect(drawn.length).toBe(nominal.objectPath.length)
  drawn.forEach(([x, y], i) => { expect(x).toBeCloseTo(nominal.objectPath[i].x, 9); expect(y).toBeCloseTo(nominal.objectPath[i].y, 9) })
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const n of [1, 2]) {
    await panel.getByRole('img', { name: `Line ${n}: contact overlay and departure direction` }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-contact-line-${n}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByTestId('kick-contact-object-path')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Line ${correct}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText(`Correct: line ${correct} reaches the potting side.`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 53', exact: true })).toBeVisible()
})
