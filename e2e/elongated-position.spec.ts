import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { elongatedPositionFinder } from '../src/engine/elongated-position'
import { startLevel } from './helpers'

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`
for (const mobile of [true, false]) test(`compare elongated region entries on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 49, level: 50, score: 0, rounds: 49, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(50, 50 * 919), { regenerate: false }), c = p.elongatedPosition!
  const along = p.balls[0].options.find(o => o.id === c.alongId)!, across = p.balls[0].options.find(o => o.id === c.acrossId)!
  const pair = elongatedPositionFinder(p.scenario)(p.balls[0].options.map(o => ({plan:o.plan, simulation:simulateShot(p.scenario,o.plan)})))!
  const selected = mobile ? across : p.balls[0].options.find(o => ![c.alongId, c.acrossId].includes(o.id))!
  await page.goto('/'); await startLevel(page, 50)
  const region = page.getByTestId('position-zone')
  await expect(region).toHaveAttribute('rx', '34')
  await expect(region).toHaveAttribute('ry', '14.6')
  const rotation = (await region.getAttribute('transform'))!.slice(7, -1).split(' ').map(Number)
  const expectedRotation = [p.scenario.objective!.ellipse!.angle * 180 / Math.PI, p.scenario.objective!.target!.x * 100, p.scenario.objective!.target!.y * 100]
  rotation.forEach((value, index) => expect(value).toBeCloseTo(expectedRotation[index], 10))
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Elongated position comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Elongated position prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${across.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The entry along the long direction has the wider tested range' : 'Compare entering along the length', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'is the across-width reference' : 'is the third alternative')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(panel.getByRole('img')).toHaveCount(2)
  await expect(panel).toContainText('68.0 cm long and 29.2 cm wide')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [option, sweep, angle] of [[along, pair.alongSweep, pair.alongAngle], [across, pair.acrossSweep, pair.acrossAngle]] as const) {
    const label = option === along ? 'along' : 'across'
    await expect(panel).toContainText(`${angle.toFixed(1)}°`)
    await expect(panel).toContainText(`${signed(sweep.low)} to ${signed(sweep.high)}`)
    await panel.getByRole('img', { name: `Stroke ${option.label}: ${label} entry into ellipse`, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/elongated-${label}-${mobile ? 'mobile' : 'desktop'}.png` })
    await panel.getByRole('button', { name: `Show stroke ${option.label} speed probes`, exact: true }).click()
    const table = panel.getByRole('table', { name: `Stroke ${option.label}: speed-only probes`, exact: true })
    const rows = await table.locator('tbody tr').evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll('th,td'), cell => cell.textContent)))
    expect(rows).toEqual(sweep.trials.map(t => [signed(t.percent), ...[t.legalPot,t.positioned,t.nextShotAvailable,t.success].map(v => v ? 'Yes' : 'No')]))
    await panel.getByRole('img', { name: `Stroke ${option.label}: speed-only finishing positions`, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/elongated-${label}-probes-${mobile ? 'mobile' : 'desktop'}.png` })
    await table.scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/elongated-${label}-table-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${along.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction has the wider tested speed range')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 51', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
