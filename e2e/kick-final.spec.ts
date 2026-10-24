import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { kickFinalEvidence } from '../src/engine/kick-final'
import { normalize } from '../src/engine/math'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`identify three-cushion final approach on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 59, level: 60, score: 0, rounds: 59, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(60, 60 * 919), { regenerate: false }), x = p.kickFinal!
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== x.referenceId)!
  const e = kickFinalEvidence(p.scenario, reference.plan, x.simulation)!, actual = p.scenario.seed % 2 ? 'A' : 'B', other = actual === 'A' ? 'B' : 'A'
  await page.goto('/'); await startLevel(page, 60)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Three-cushion final approach', exact: true })
  const predictions = panel.getByRole('group', { name: 'Final approach prediction' })
  await expect(panel.getByRole('img')).toHaveCount(2)
  for (let i = 1; i <= 3; i++) await expect(panel.getByTestId(`final-rebound-${i}`)).toHaveText(`R${i}`)
  await expect(panel.getByTestId('final-object-path')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Arrow ${other}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? `Arrow ${other} is the launch direction` : `Arrow ${actual} shows the final approach.`, { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference finish ${reference.label}.` : 'You chose another finish')
  await expect(panel).toContainText(`${e.angle.toFixed(1)}°`)
  await expect(panel.getByTestId('final-object-path')).toHaveCount(1)
  for (const time of [...e.rebounds.map(r => r.time), e.contact.time]) await expect(panel).toContainText(`${time.toFixed(2)} s`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const path = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(expected.length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(expected[j].x, 9); expect(b).toBeCloseTo(expected[j].y, 9) })
  }
  for (const [i, leg] of e.legs.entries()) await checkPath(`final-leg-${i + 1}`, leg)
  for (const label of ['A', 'B']) {
    const d = label === actual ? normalize(e.contact.incoming) : e.launch
    await checkPath(`final-arrow-${label}`, [{ x: -d.x * .13, y: -d.y * .13 }, { x: -d.x * .018, y: -d.y * .018 }])
  }
  await expect(panel.getByTestId(`final-arrow-${other}`)).toHaveAttribute('stroke-dasharray', '.006 .004')
  for (const [i, rebound] of e.rebounds.entries()) {
    const xy = (await panel.getByTestId(`final-rebound-${i + 1}`).getAttribute('transform'))!.slice(10, -1).split(' ').map(Number)
    expect(xy[0]).toBeCloseTo(rebound.position.x, 9); expect(xy[1]).toBeCloseTo(rebound.position.y, 9)
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [key, name] of [['route', 'Cue-ball route through R1, R2 and R3 to ball 1'], ['arrows', 'Compare incoming arrows A and B at the cue-ball contact center']] as const) {
    await panel.getByRole('img', { name, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-final-${key}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByTestId('final-object-path')).toHaveCount(0)
  await expect(panel.getByTestId('final-leg-4')).toHaveAttribute('stroke', '#7de3ef')
  await predictions.getByRole('button', { name: `Arrow ${actual}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText(`Correct: arrow ${actual} shows the final approach.`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 61', exact: true })).toBeVisible()
})
