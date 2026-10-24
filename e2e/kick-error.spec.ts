import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { kickErrorEvidence } from '../src/engine/kick-error'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`trace angular error on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 58, level: 59, score: 0, rounds: 58, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(59, 59 * 919), { regenerate: false }), x = p.kickError!
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== x.referenceId)!
  const e = kickErrorEvidence(p.scenario, reference.plan, x)!, legs = ['Launch → R1', 'R1 → R2', 'R2 → contact']
  await page.goto('/'); await startLevel(page, 59)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Kick angular-error comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Separation growth prediction' })
  await expect(panel.getByRole('img')).toHaveCount(1)
  await expect(panel.getByRole('table')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: legs[(e.largest + 1) % 3], exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? `The largest increase is on ${legs[e.largest]}.` : `${legs[e.largest]} adds the most separation.`, { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference finish ${reference.label}.` : 'You chose another finish')
  await expect(panel).toContainText((x.radians * 180 / Math.PI).toFixed(3) + '°')
  await expect(panel).toContainText('not equal-time snapshots')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  for (let i = 0; i < 3; i++) {
    await expect(panel.getByTestId(`error-spread-${i}`)).toHaveText(`${(e.spreads[i] * 1000).toFixed(1)} mm`)
    await expect(panel.getByTestId(`error-growth-${i}`)).toHaveText(`${e.growth[i] >= 0 ? '+' : ''}${(e.growth[i] * 1000).toFixed(1)} mm`)
    for (const [key, data] of [['minus', e.minus], ['plus', e.plus]] as const) {
      expect(Number(await panel.getByTestId(`error-inset-${key}-${i}`).getAttribute('cx'))).toBeCloseTo(data.positions[i].x - e.reference.positions[i].x, 9)
      expect(Number(await panel.getByTestId(`error-inset-${key}-${i}`).getAttribute('cy'))).toBeCloseTo(data.positions[i].y - e.reference.positions[i].y, 9)
    }
  }
  for (const [key, data] of [['minus', e.minus], ['plus', e.plus]] as const) {
    const actual = (await panel.getByTestId(`error-path-${key}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(actual.length).toBe(data.path.length)
    actual.forEach(([a, b], i) => { expect(a).toBeCloseTo(data.path[i].x, 9); expect(b).toBeCloseTo(data.path[i].y, 9) })
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-error-table-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('img', { name: 'R1, R2 and contact separation at a shared magnified scale', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-error-inset-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await predictions.getByRole('button', { name: legs[e.largest], exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText(`Correct: ${legs[e.largest]} adds the most separation.`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 60', exact: true })).toBeVisible()
})
